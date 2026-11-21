// Spend guard for Google Maps Platform calls.
//
// - Counts billable events per SKU per month in KV.
// - Refuses calls past SOFT_LIMITS (well inside Google's free monthly caps).
// - Once any limit is hit, writes a "budget:locked" key. While that key
//   exists, NO Google call is made — not even next month. It is only cleared
//   manually (delete the key in the Cloudflare KV dashboard).
// - Fail-safe: if KV or the API key is missing, no Google call is made.

// Google free monthly caps: Essentials 10k, Pro 5k, Enterprise 1k per SKU.
// We stop at ~80% of those.
export const SOFT_LIMITS = {
  place_details_enterprise: 800, // free cap 1,000
  route_matrix_elements: 8000, // free cap 10,000 (Essentials)
};

const LOCK_KEY = "budget:locked";
const monthKey = (sku) => `usage:${new Date().toISOString().slice(0, 7)}:${sku}`;

export class BudgetError extends Error {}

export function assertConfigured(env) {
  if (!env.KV) throw new BudgetError("KV bağlı değil: Google çağrıları kapalı.");
  if (!env.GOOGLE_MAPS_KEY) throw new BudgetError("GOOGLE_MAPS_KEY tanımlı değil: Google çağrıları kapalı.");
}

// Reserve `n` billable events for `sku` BEFORE calling Google.
export async function reserve(env, sku, n = 1) {
  assertConfigured(env);
  const limit = SOFT_LIMITS[sku];
  if (limit == null) throw new BudgetError(`Bilinmeyen SKU: ${sku}`);

  const lock = await env.KV.get(LOCK_KEY);
  if (lock) throw new BudgetError(`Bütçe kilidi aktif (${lock}). Google çağrıları durduruldu.`);

  const key = monthKey(sku);
  const used = parseInt((await env.KV.get(key)) || "0", 10);
  if (used + n > limit) {
    await env.KV.put(LOCK_KEY, `${sku} ${used}/${limit} @ ${new Date().toISOString()}`);
    throw new BudgetError(`Aylık güvenli limit doldu (${sku}: ${used}/${limit}). Google çağrıları durduruldu.`);
  }
  await env.KV.put(key, String(used + n), { expirationTtl: 60 * 60 * 24 * 70 });
  return used + n;
}

export async function usageReport(env) {
  const out = { configured: !!(env.KV && env.GOOGLE_MAPS_KEY), locked: null, month: new Date().toISOString().slice(0, 7), usage: {} };
  if (!env.KV) return out;
  out.locked = await env.KV.get(LOCK_KEY);
  for (const [sku, limit] of Object.entries(SOFT_LIMITS)) {
    out.usage[sku] = { used: parseInt((await env.KV.get(monthKey(sku))) || "0", 10), limit };
  }
  return out;
}
