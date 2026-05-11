import "server-only";
/**
 * Payngo / מחסני החשמל (payngo.co.il) Price Scraper
 *
 * Tries three endpoints in order; returns results from the first that works.
 *   1. POST https://api.fastsimon.com/search
 *   2. GET  https://www.payngo.co.il/search?type=product&q=QUERY  (Accept: application/json)
 *   3. GET  https://www.payngo.co.il/search/suggest?q=QUERY
 */

import { RawResult } from "@/lib/search/types";

const PAYNGO_BASE    = "https://www.payngo.co.il";
const FAST_SIMON_URL = "https://api.fastsimon.com/search";

// ── Types ─────────────────────────────────────────────────────────────────────

interface FastSimonProduct {
  title?:          string;
  label?:          string;
  price?:          number | string;
  featured_image?: string;
  image?:          string;
  url?:            string;
  product_url?:    string;
}

interface FastSimonResponse {
  results?:  Array<{ products?: FastSimonProduct[] }>;
  products?: FastSimonProduct[];
  hits?:     FastSimonProduct[];
}

interface PayngoProduct {
  title?:          string;
  price?:          number | string;
  featured_image?: string;
  url?:            string;
  handle?:         string;
}

interface PayngoSearchResponse {
  results?:  { products?: PayngoProduct[] };
  products?: PayngoProduct[];
}

// ── Helper ────────────────────────────────────────────────────────────────────

function toResult(
  name: string, price: number, productUrl: string, imageUrl: string
): RawResult {
  return {
    store:         "payngo",
    storeName:     "מחסני החשמל",
    productName:   name,
    originalPrice: price,
    imageUrl,
    productUrl,
  };
}

function resolveUrl(rawUrl: string, fallback: string): string {
  if (!rawUrl) return fallback;
  return rawUrl.startsWith("http") ? rawUrl : `${PAYNGO_BASE}${rawUrl.startsWith("/") ? "" : "/"}${rawUrl}`;
}

// ── Endpoint 1: POST Fast Simon ───────────────────────────────────────────────

async function tryFastSimon(query: string): Promise<RawResult[] | null> {
  console.log("[PAYNGO] Trying endpoint 1: POST Fast Simon");
  try {
    const res = await fetch(FAST_SIMON_URL, {
      method:  "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body:    JSON.stringify({ q: query, UUID: "payngo-il", store_id: "payngo", pg: 1, ps: 5 }),
      signal:  AbortSignal.timeout(10_000),
    });

    console.log(`[PAYNGO] Response status: ${res.status}`);
    if (!res.ok) return null;

    const text = await res.text();
    console.log(`[PAYNGO] Response body preview: ${text.slice(0, 200)}`);

    const data = JSON.parse(text) as FastSimonResponse;
    const products: FastSimonProduct[] =
      data?.results?.[0]?.products ?? data?.products ?? data?.hits ?? [];

    if (!products.length) return null;

    const results: RawResult[] = [];
    for (const p of products.slice(0, 10)) {
      const name = (p.title ?? p.label ?? "").trim();
      if (!name) continue;
      const rawPrice = typeof p.price === "string" ? parseFloat(p.price) : (p.price ?? 0);
      if (!rawPrice || rawPrice < 10 || rawPrice > 1_000_000) continue;
      results.push(toResult(
        name, rawPrice,
        resolveUrl(p.url ?? p.product_url ?? "", ""),
        p.featured_image ?? p.image ?? ""
      ));
    }
    return results.length ? results : null;

  } catch (err) {
    console.log(`[PAYNGO] Endpoint 1 error: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

// ── Endpoint 2: GET Payngo search with Accept: application/json ───────────────

async function tryPayngoJson(query: string): Promise<RawResult[] | null> {
  console.log("[PAYNGO] Trying endpoint 2: GET Payngo search JSON");
  try {
    const url = `${PAYNGO_BASE}/search?type=product&q=${encodeURIComponent(query)}`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15",
        "Accept":     "application/json",
      },
      signal:   AbortSignal.timeout(10_000),
      redirect: "follow",
    });

    console.log(`[PAYNGO] Response status: ${res.status}`);
    if (!res.ok) return null;

    const text = await res.text();
    console.log(`[PAYNGO] Response body preview: ${text.slice(0, 200)}`);

    const data = JSON.parse(text) as PayngoSearchResponse;
    const products: PayngoProduct[] = data?.results?.products ?? data?.products ?? [];
    if (!products.length) return null;

    const results: RawResult[] = [];
    for (const p of products.slice(0, 10)) {
      const name = (p.title ?? "").trim();
      if (!name) continue;
      const rawPrice = typeof p.price === "string" ? parseFloat(p.price) : (p.price ?? 0);
      if (!rawPrice || rawPrice < 10 || rawPrice > 1_000_000) continue;
      const rawUrl = p.url ?? (p.handle ? `${PAYNGO_BASE}/products/${p.handle}` : "");
      results.push(toResult(name, rawPrice, resolveUrl(rawUrl, ""), p.featured_image ?? ""));
    }
    return results.length ? results : null;

  } catch (err) {
    console.log(`[PAYNGO] Endpoint 2 error: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

// ── Endpoint 3: GET suggest ───────────────────────────────────────────────────

async function tryPayngoSuggest(query: string): Promise<RawResult[] | null> {
  console.log("[PAYNGO] Trying endpoint 3: GET suggest");
  try {
    const url = `${PAYNGO_BASE}/search/suggest?q=${encodeURIComponent(query)}`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15",
        "Accept":     "application/json",
      },
      signal:   AbortSignal.timeout(8_000),
      redirect: "follow",
    });

    console.log(`[PAYNGO] Response status: ${res.status}`);
    if (!res.ok) return null;

    const text = await res.text();
    console.log(`[PAYNGO] Response body preview: ${text.slice(0, 200)}`);

    const data = JSON.parse(text) as Record<string, unknown>;
    const products: PayngoProduct[] = Array.isArray(data)
      ? (data as PayngoProduct[])
      : (data?.products ?? data?.results ?? []) as PayngoProduct[];
    if (!products.length) return null;

    const results: RawResult[] = [];
    for (const p of products.slice(0, 10)) {
      const name = (p.title ?? "").trim();
      if (!name) continue;
      const rawPrice = typeof p.price === "string" ? parseFloat(p.price) : (p.price ?? 0);
      if (!rawPrice || rawPrice < 10 || rawPrice > 1_000_000) continue;
      const rawUrl = p.url ?? (p.handle ? `${PAYNGO_BASE}/products/${p.handle}` : "");
      results.push(toResult(name, rawPrice, resolveUrl(rawUrl, ""), ""));
    }
    return results.length ? results : null;

  } catch (err) {
    console.log(`[PAYNGO] Endpoint 3 error: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────

export async function scrapePayngo(query: string): Promise<RawResult[]> {
  const raw =
    (await tryFastSimon(query)) ??
    (await tryPayngoJson(query)) ??
    (await tryPayngoSuggest(query)) ??
    [];

  const results = raw.sort((a, b) => a.originalPrice - b.originalPrice).slice(0, 5);
  console.log(`[PAYNGO] Fetched ${results.length} results for query: ${query}`);
  return results;
}
