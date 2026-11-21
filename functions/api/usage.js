// GET /api/usage -> this month's Google usage vs. safe limits, and lock status.
import { usageReport } from "../_lib/budget.js";

export async function onRequestGet({ env }) {
  return new Response(JSON.stringify(await usageReport(env), null, 2), {
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}
