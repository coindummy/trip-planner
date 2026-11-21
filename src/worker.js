// Cloudflare Workers entry (used when the project is deployed as a Worker with
// static assets). Routes /api/* to the same handlers as the Pages Functions;
// everything else is served from ./public.
import { onRequestGet as listHandler } from "../functions/api/list.js";
import { onRequestGet as pingHandler } from "../functions/api/ping.js";

const routes = {
  "/api/list": listHandler,
  "/api/ping": pingHandler,
};

export default {
  async fetch(request, env, ctx) {
    const { pathname } = new URL(request.url);
    const handler = routes[pathname];
    if (handler) {
      if (request.method !== "GET") return new Response("Method not allowed", { status: 405 });
      return handler({ request, env, ctx });
    }
    return env.ASSETS.fetch(request);
  },
};
