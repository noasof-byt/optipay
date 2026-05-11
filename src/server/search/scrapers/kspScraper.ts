import "server-only";
/**
 * KSP (ksp.co.il) Price Scraper
 *
 * KSP is a React SPA — HTML fetch returns a shell with no products.
 * Uses KSP's internal JSON API with x-requested-with header.
 *
 * Tries three endpoint variants in order.
 *
 * NO Playwright — fetch + JSON only (Vercel serverless constraint).
 */

import { LivePrice } from "@/types/search";
import { logger }    from "@/lib/logger";

const KSP_BASE = "https://ksp.co.il";

const API_HEADERS: Record<string, string> = {
  "User-Agent":       "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1",
  "Accept":           "application/json",
  "Referer":          "https://ksp.co.il/",
  "Accept-Language":  "he-IL,he;q=0.9",
  "x-requested-with": "XMLHttpRequest",
};

function extractProducts(data: unknown): LivePrice[] {
  const raw = data as Record<string, unknown>;
  const products: unknown[] =
    (Array.isArray(raw?.data)      ? raw.data      : null) ??
    (Array.isArray(raw?.products)  ? raw.products  : null) ??
    (Array.isArray(raw?.items)     ? raw.items     : null) ??
    (Array.isArray(raw?.results)   ? raw.results   : null) ??
    (Array.isArray((raw?.data as Record<string, unknown>)?.products)
      ? (raw.data as Record<string, unknown>).products as unknown[]
      : null) ??
    [];

  if (!products.length) return [];

  return (products as Record<string, unknown>[])
    .slice(0, 5)
    .map((p) => {
      const price = Number(p.price ?? p.Price ?? p.salePrice ?? p.sale_price ?? 0);
      const rawUrl = String(p.url ?? p.link ?? p.webUrl ?? p.web_url ?? "");
      const fullUrl = rawUrl.startsWith("http")
        ? rawUrl
        : rawUrl
          ? `${KSP_BASE}${rawUrl.startsWith("/") ? "" : "/"}${rawUrl}`
          : `${KSP_BASE}/`;
      return {
        storeName: "KSP",
        price,
        currency:  "ILS",
        url:       fullUrl,
        inStock:   true,
        source:    "ksp" as const,
        fetchedAt: new Date(),
      };
    })
    .filter((r) => r.price >= 10 && r.price <= 1_000_000);
}

async function tryKspEndpoint(url: string): Promise<LivePrice[]> {
  logger.info(`[KSP] Trying endpoint`, { url });
  const res = await fetch(url, {
    headers:  API_HEADERS,
    signal:   AbortSignal.timeout(10_000),
    redirect: "follow",
  });

  logger.info(`[KSP] Status: ${res.status}`);
  if (!res.ok) return [];

  const text = await res.text();
  logger.info(`[KSP] Response preview: ${text.slice(0, 300)}`);

  // If we got HTML back (SPA shell) — this endpoint doesn't work
  if (text.trimStart().startsWith("<")) {
    logger.warn("[KSP] Got HTML instead of JSON — skipping endpoint");
    return [];
  }

  return extractProducts(JSON.parse(text));
}

export async function scrapeKsp(query: string): Promise<LivePrice[]> {
  const eq = encodeURIComponent(query);

  const endpoints = [
    `${KSP_BASE}/app/api/search?q=${eq}&from=0&size=5`,
    `${KSP_BASE}/app/api/search?keyword=${eq}&from=0&size=5`,
    `${KSP_BASE}/app/api/products/search?q=${eq}&limit=5`,
  ];

  for (const url of endpoints) {
    try {
      const results = await tryKspEndpoint(url);
      if (results.length) {
        logger.info(`[KSP] Scrape complete`, { query, found: results.length, url });
        return results.sort((a, b) => a.price - b.price).slice(0, 5);
      }
    } catch (e) {
      logger.warn(`[KSP] Endpoint failed`, { url, err: String(e) });
    }
  }

  logger.warn("[KSP] All endpoints failed", { query });
  return [];
}
