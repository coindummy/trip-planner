// GET /api/details?placeId=<Google place id>
// Returns category + opening hours for a place. Each place is fetched from
// Google at most once per 30 days; afterwards it is served from KV for free.
import { reserve, BudgetError } from "../_lib/budget.js";

const FIELDS = "id,displayName,types,primaryType,regularOpeningHours,location";
const CACHE_TTL = 60 * 60 * 24 * 30;

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });

export async function onRequestGet({ request, env }) {
  const placeId = new URL(request.url).searchParams.get("placeId");
  if (!placeId || !/^[\w-]{10,}$/.test(placeId)) return json({ error: "Geçersiz placeId" }, 400);

  try {
    if (env.KV) {
      const cached = await env.KV.get(`place:${placeId}`, "json");
      if (cached) return json({ ...cached, cached: true });
    }

    await reserve(env, "place_details_enterprise", 1);

    const res = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?languageCode=tr`, {
      headers: { "X-Goog-Api-Key": env.GOOGLE_MAPS_KEY, "X-Goog-FieldMask": FIELDS },
    });
    const data = await res.json();
    if (!res.ok) return json({ error: data?.error?.message || `Google HTTP ${res.status}` }, 502);

    await env.KV.put(`place:${placeId}`, JSON.stringify(data), { expirationTtl: CACHE_TTL });
    return json({ ...data, cached: false });
  } catch (e) {
    if (e instanceof BudgetError) return json({ error: e.message, budget: true }, 429);
    return json({ error: "Beklenmeyen hata: " + String(e?.message || e) }, 500);
  }
}
