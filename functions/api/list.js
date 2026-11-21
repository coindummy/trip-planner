// Cloudflare Pages Function: GET /api/list?url=<Google Maps shared list link>
// Resolves a shared Google Maps list link and returns its places as JSON.
//
// NOTE: This uses the same undocumented endpoint the Google Maps list page
// itself calls (entitylist/getlist). It is not an official API and may break
// if Google changes its internals.

const SHORTLINK_UA = "Mozilla/5.0"; // plain UA -> short-link service answers with a 302
const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
// Pre-accepted consent cookie so EU edge locations don't get the consent page.
const CONSENT_COOKIE = "SOCS=CAESEwgDEgk0ODE3Nzk3MjQaAmVuIAEaBgiA_LyaBg; CONSENT=YES+";

const json = (body, status = 200) =>
  new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });

function mergeCookies(jar, res) {
  const raw = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
  for (const c of raw) {
    const [pair] = c.split(";");
    const i = pair.indexOf("=");
    if (i > 0) jar[pair.slice(0, i).trim()] = pair.slice(i + 1).trim();
  }
}
const cookieHeader = (jar) =>
  [CONSENT_COOKIE, ...Object.entries(jar).map(([k, v]) => `${k}=${v}`)].join("; ");

async function resolveList(url, jar) {
  let current = url;
  for (let hop = 0; hop < 8; hop++) {
    if (/\/placelists\/list\/|!2s-?[\w-]+!/.test(current)) break;
    const res = await fetch(current, {
      redirect: "manual",
      headers: { "user-agent": SHORTLINK_UA, cookie: cookieHeader(jar) },
    });
    mergeCookies(jar, res);
    const loc = res.headers.get("location");
    if (!loc) break;
    current = new URL(loc, current).toString();
  }

  const decoded = (() => {
    try { return decodeURIComponent(current); } catch { return current; }
  })();
  const idMatch =
    decoded.match(/!2s(-?[\w-]+)!/) || decoded.match(/\/placelists\/list\/(-?[\w-]+)/);
  const tokenMatch =
    current.match(/token%3D([\w-]+)/) || decoded.match(/[?&]token=([\w-]+)/);

  return {
    finalUrl: current,
    listId: idMatch ? idMatch[1] : null,
    token: tokenMatch ? tokenMatch[1] : null,
  };
}

function parsePlace(p) {
  const info = Array.isArray(p?.[1]) ? p[1] : [];
  const ll = info[5];
  const cid = info[6];
  return {
    name: p?.[2] ?? null,
    label: info[2] ?? null,
    address: info[4] ?? null,
    lat: Array.isArray(ll) && ll.length >= 4 ? ll[2] : null,
    lng: Array.isArray(ll) && ll.length >= 4 ? ll[3] : null,
    cid: Array.isArray(cid) && cid.length >= 2 ? `${cid[0]}:${cid[1]}` : null,
    placeId: info[7] ?? null,
  };
}

async function fetchPlaces(listId, token, jar) {
  let listPage = `https://www.google.com/maps/placelists/list/${listId}`;
  if (token) listPage += `?token=${token}`;

  const session = crypto.randomUUID().replace(/-/g, "").slice(0, 22);
  const pb =
    "!2e2!3e2!4i500!6m3" +
    `!1s${session}` +
    "!15i204459!28e2" +
    `!13s${encodeURIComponent(listPage)}` +
    "!16b1";
  const apiUrl =
    "https://www.google.com/maps/preview/entitylist/getlist?authuser=0&hl=en&gl=nl&pb=" + pb;

  const res = await fetch(apiUrl, {
    headers: { "user-agent": BROWSER_UA, cookie: cookieHeader(jar) },
  });
  let text = await res.text();
  if (!res.ok) throw new Error(`getlist HTTP ${res.status}: ${text.slice(0, 200)}`);
  if (text.startsWith(")]}'")) text = text.slice(4);

  const data = JSON.parse(text);
  const title = data?.[0]?.[4] ?? null;
  const raw = data?.[0]?.[8] ?? [];
  return { title, places: raw.map(parsePlace) };
}

export async function onRequestGet(ctx) {
  try {
    return await handle(ctx);
  } catch (e) {
    return json({ error: "Beklenmeyen hata: " + String(e?.message || e) }, 500);
  }
}

async function handle({ request }) {
  const target = new URL(request.url).searchParams.get("url");
  if (!target) return json({ error: "url parametresi eksik" }, 400);

  let host;
  try { host = new URL(target).hostname; } catch { return json({ error: "Geçersiz URL" }, 400); }
  if (!/(^|\.)(goo\.gl|google\.[a-z.]+)$/.test(host)) {
    return json({ error: "Sadece Google Maps linkleri kabul ediliyor" }, 400);
  }

  const jar = {};
  try {
    const resolved = await resolveList(target, jar);
    if (!resolved.listId) {
      return json({ error: "Linkte liste kimliği bulunamadı", finalUrl: resolved.finalUrl }, 422);
    }
    const { title, places } = await fetchPlaces(resolved.listId, resolved.token, jar);
    return json({ title, count: places.length, listId: resolved.listId, places });
  } catch (e) {
    return json({ error: String(e.message || e) }, 502);
  }
}
