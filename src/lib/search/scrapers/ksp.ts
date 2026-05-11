import "server-only";
/**
 * KSP (ksp.co.il) Price Scraper
 *
 * Tries three JSON API endpoints in order; returns results from the first
 * that responds with 200 + parseable product data.
 */

import { RawResult } from "@/lib/search/types";

const KSP_BASE = "https://ksp.co.il";

const ENDPOINTS: Array<(q: string) => string> = [
  (q) => `${KSP_BASE}/app/api/search?q=${encodeURIComponent(q)}&from=0&size=5`,
  (q) => `${KSP_BASE}/search?q=${encodeURIComponent(q)}`,
  (q) => `https://api.ksp.co.il/search?keyword=${encodeURIComponent(q)}`,
];

const API_HEADERS: Record<string, string> = {
  "User-Agent":      "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15",
  "Accept":          "application/json",
  "Referer":         "https://ksp.co.il/",
  "Accept-Language": "he-IL,he;q=0.9",
};

interface KspProduct {
  name?:    string;
  title?:   string;
  price?:   number | string;
  img?:     string;
  img_url?: string;
  image?:   string;
  url?:     string;
  link?:    string;
}

interface KspApiResponse {
  data?:     { products?: KspProduct[] };
  products?: KspProduct[];
  items?:    KspProduct[];
  results?:  KspProduct[];
}

function parseProducts(products: KspProduct[]): RawResult[] {
  const results: RawResult[] = [];

  for (const p of products.slice(0, 10)) {
    const name = (p.name ?? p.title ?? "").trim();
    if (!name) continue;

    const rawPrice = typeof p.price === "string" ? parseFloat(p.price) : (p.price ?? 0);
    if (!rawPrice || rawPrice < 10 || rawPrice > 1_000_000) continue;

    const rawUrl     = p.url ?? p.link ?? "";
    const productUrl = rawUrl.startsWith("http")
      ? rawUrl
      : rawUrl
        ? `${KSP_BASE}${rawUrl.startsWith("/") ? "" : "/"}${rawUrl}`
        : "";
    if (!productUrl.includes("ksp.co.il")) continue;

    const rawImg   = p.img ?? p.img_url ?? p.image ?? "";
    const imageUrl = rawImg.startsWith("http")
      ? rawImg
      : rawImg
        ? `${KSP_BASE}${rawImg.startsWith("/") ? "" : "/"}${rawImg}`
        : "";

    results.push({
      store:         "ksp",
      storeName:     "KSP",
      productName:   name,
      originalPrice: rawPrice,
      imageUrl,
      productUrl,
    });
  }

  return results.sort((a, b) => a.originalPrice - b.originalPrice).slice(0, 5);
}

export async function scrapeKsp(query: string): Promise<RawResult[]> {
  for (let i = 0; i < ENDPOINTS.length; i++) {
    const url = ENDPOINTS[i](query);
    console.log(`[KSP] Trying: ${url}`);

    try {
      const res = await fetch(url, {
        headers:  API_HEADERS,
        signal:   AbortSignal.timeout(10_000),
        redirect: "follow",
      });

      console.log(`[KSP] Response status: ${res.status}`);

      if (!res.ok) continue;

      const contentType = res.headers.get("content-type") ?? "";
      if (!contentType.includes("json")) {
        console.log(`[KSP] Non-JSON content-type on endpoint ${i + 1}: ${contentType}`);
        continue;
      }

      const json = await res.json() as KspApiResponse;
      const products: KspProduct[] =
        json?.data?.products ??
        json?.products ??
        json?.items ??
        json?.results ??
        [];

      if (!products.length) {
        console.log(`[KSP] 0 products from endpoint ${i + 1}`);
        continue;
      }

      const results = parseProducts(products);
      console.log(`[KSP] Fetched ${results.length} results for query: ${query}`);
      return results;

    } catch (err) {
      console.log(`[KSP] Error on endpoint ${i + 1}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  console.log(`[KSP] All endpoints failed for query: ${query}`);
  return [];
}
