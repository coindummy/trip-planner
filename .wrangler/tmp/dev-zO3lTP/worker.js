var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// functions/api/list.js
var SHORTLINK_UA = "Mozilla/5.0";
var BROWSER_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
var CONSENT_COOKIE = "SOCS=CAESEwgDEgk0ODE3Nzk3MjQaAmVuIAEaBgiA_LyaBg; CONSENT=YES+";
var json = /* @__PURE__ */ __name((body, status = 200) => new Response(JSON.stringify(body, null, 2), {
  status,
  headers: { "content-type": "application/json; charset=utf-8" }
}), "json");
function mergeCookies(jar, res) {
  const raw = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
  for (const c of raw) {
    const [pair] = c.split(";");
    const i = pair.indexOf("=");
    if (i > 0) jar[pair.slice(0, i).trim()] = pair.slice(i + 1).trim();
  }
}
__name(mergeCookies, "mergeCookies");
var cookieHeader = /* @__PURE__ */ __name((jar) => [CONSENT_COOKIE, ...Object.entries(jar).map(([k, v]) => `${k}=${v}`)].join("; "), "cookieHeader");
async function resolveList(url, jar) {
  let current = url;
  for (let hop = 0; hop < 8; hop++) {
    if (/\/placelists\/list\/|!2s-?[\w-]+!/.test(current)) break;
    const res = await fetch(current, {
      redirect: "manual",
      headers: { "user-agent": SHORTLINK_UA, cookie: cookieHeader(jar) }
    });
    mergeCookies(jar, res);
    const loc = res.headers.get("location");
    if (!loc) break;
    current = new URL(loc, current).toString();
  }
  const decoded = (() => {
    try {
      return decodeURIComponent(current);
    } catch {
      return current;
    }
  })();
  const idMatch = decoded.match(/!2s(-?[\w-]+)!/) || decoded.match(/\/placelists\/list\/(-?[\w-]+)/);
  const tokenMatch = current.match(/token%3D([\w-]+)/) || decoded.match(/[?&]token=([\w-]+)/);
  return {
    finalUrl: current,
    listId: idMatch ? idMatch[1] : null,
    token: tokenMatch ? tokenMatch[1] : null
  };
}
__name(resolveList, "resolveList");
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
    placeId: info[7] ?? null
  };
}
__name(parsePlace, "parsePlace");
async function fetchPlaces(listId, token, jar) {
  let listPage = `https://www.google.com/maps/placelists/list/${listId}`;
  if (token) listPage += `?token=${token}`;
  const session = crypto.randomUUID().replace(/-/g, "").slice(0, 22);
  const pb = `!2e2!3e2!4i500!6m3!1s${session}!15i204459!28e2!13s${encodeURIComponent(listPage)}!16b1`;
  const apiUrl = "https://www.google.com/maps/preview/entitylist/getlist?authuser=0&hl=en&gl=nl&pb=" + pb;
  const res = await fetch(apiUrl, {
    headers: { "user-agent": BROWSER_UA, cookie: cookieHeader(jar) }
  });
  let text = await res.text();
  if (!res.ok) throw new Error(`getlist HTTP ${res.status}: ${text.slice(0, 200)}`);
  if (text.startsWith(")]}'")) text = text.slice(4);
  const data = JSON.parse(text);
  const title = data?.[0]?.[4] ?? null;
  const raw = data?.[0]?.[8] ?? [];
  return { title, places: raw.map(parsePlace) };
}
__name(fetchPlaces, "fetchPlaces");
async function onRequestGet(ctx) {
  try {
    return await handle(ctx);
  } catch (e) {
    return json({ error: "Beklenmeyen hata: " + String(e?.message || e) }, 500);
  }
}
__name(onRequestGet, "onRequestGet");
async function handle({ request }) {
  const target = new URL(request.url).searchParams.get("url");
  if (!target) return json({ error: "url parametresi eksik" }, 400);
  let host;
  try {
    host = new URL(target).hostname;
  } catch {
    return json({ error: "Ge\xE7ersiz URL" }, 400);
  }
  if (!/(^|\.)(goo\.gl|google\.[a-z.]+)$/.test(host)) {
    return json({ error: "Sadece Google Maps linkleri kabul ediliyor" }, 400);
  }
  const jar = {};
  try {
    const resolved = await resolveList(target, jar);
    if (!resolved.listId) {
      return json({ error: "Linkte liste kimli\u011Fi bulunamad\u0131", finalUrl: resolved.finalUrl }, 422);
    }
    const { title, places } = await fetchPlaces(resolved.listId, resolved.token, jar);
    return json({ title, count: places.length, listId: resolved.listId, places });
  } catch (e) {
    return json({ error: String(e.message || e) }, 502);
  }
}
__name(handle, "handle");

// functions/api/ping.js
var onRequestGet2 = /* @__PURE__ */ __name(() => new Response(JSON.stringify({ ok: true, time: (/* @__PURE__ */ new Date()).toISOString() }), {
  headers: { "content-type": "application/json; charset=utf-8" }
}), "onRequestGet");

// src/worker.js
var routes = {
  "/api/list": onRequestGet,
  "/api/ping": onRequestGet2
};
var worker_default = {
  async fetch(request, env, ctx) {
    const { pathname } = new URL(request.url);
    const handler = routes[pathname];
    if (handler) {
      if (request.method !== "GET") return new Response("Method not allowed", { status: 405 });
      return handler({ request, env, ctx });
    }
    return env.ASSETS.fetch(request);
  }
};

// ../../../tmp/wr/node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// ../../../tmp/wr/node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    const body = JSON.stringify(error);
    const headers = {
      "Content-Type": "application/json",
      "MF-Experimental-Error-Stack": "true"
    };
    const encoded = encodeURIComponent(body);
    if (encoded.length <= 8192) {
      headers["MF-Experimental-Error-Stack-Payload"] = encoded;
    }
    return new Response(body, { status: 500, headers });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-klflcZ/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = worker_default;

// ../../../tmp/wr/node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-klflcZ/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  scheduledTime;
  cron;
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=worker.js.map
