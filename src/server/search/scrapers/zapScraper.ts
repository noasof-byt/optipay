import "server-only";
/**
 * ZAP (zap.co.il) Price Scraper
 *
 * ZAP renders products client-side — static HTML fetch yields no products.
 * Uses ZAP's internal JSON API instead.
 *
 * Endpoint 1: api.zap.co.il/api/ProductSearch/
 * Endpoint 2: www.zap.co.il/api/search (fallback)
 *
 * NO Playwright — fetch + JSON only (Vercel serverless constraint).
 */

import { LivePrice } from "@/types/search";
import { logger }    from "@/lib/logger";

const ZAP_BASE = "https://www.zap.co.il";

const ZAP_EP1 = (q: string) =>
  `https://api.zap.co.il/api/ProductSearch/?keyword=${encodeURIComponent(q)}&pageSize=5&pageNumber=1`;

const ZAP_EP2 = (q: string) =>
  `${ZAP_BASE}/api/search?term=${encodeURIComponent(q)}&pageSize=5`;

const API_HEADERS: Record<string, string> = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept":     "application/json",
  "Referer":    "https://www.zap.co.il/",
  "Origin":     "https://www.zap.co.il",
};

function parseZapProducts(data: unknown): LivePrice[] {
  // Try common response shapes
  const raw = data as Record<string, unknown>;
  const products: unknown[] =
    (Array.isArray(raw?.Products)  ? raw.Products  : null) ??
    (Array.isArray(raw?.products)  ? raw.products  : null) ??
    (Array.isArray(raw?.Items)     ? raw.Items     : null) ??
    (Array.isArray(raw?.items)     ? raw.items     : null) ??
    (Array.isArray(raw?.results)   ? raw.results   : null) ??
    (Array.isArray(raw?.data)      ? raw.data      : null) ??
    [];

  if (!products.length) return [];

  return (products as Record<string, unknown>[])
    .slice(0, 5)
    .map((p) => {
      const price = Number(
        p.MinPrice ?? p.minPrice ?? p.Price ?? p.price ?? p.SalePrice ?? 0
      );

      const rawUrl = String(
        p.ProductURL ?? p.productUrl ?? p.ProductUrl ??
        p.URL ?? p.url ?? p.link ?? ""
      );
      const fullUrl = rawUrl.startsWith("http")
        ? rawUrl
        : rawUrl
          ? `${ZAP_BASE}${rawUrl.startsWith("/") ? "" : "/"}${rawUrl}`
          : "";

      return {
        storeName: "ZAP",
        price,
        currency:  "ILS",
        url:       fullUrl,
        inStock:   true,
        source:    "zap" as const,
        fetchedAt: new Date(),
      };
    })
    // Filter bad prices AND results that fall back to homepage (no real product URL)
    .filter((r) => r.price >= 10 && r.price <= 1_000_000 && r.url.includes("zap.co.il") && r.url !== ZAP_BASE);
}

async function tryEndpoint(url: string): Promise<LivePrice[]> {
  logger.info(`[ZAP] API status: fetching`, { url });
  const res = await fetch(url, {
    headers:  API_HEADERS,
    signal:   AbortSignal.timeout(12_000),
    redirect: "follow",
  });

  logger.info(`[ZAP] API status: ${res.status}`);
  if (!res.ok) return [];

  const text = await res.text();
  logger.info(`[ZAP] Response preview: ${text.slice(0, 300)}`);

  return parseZapProducts(JSON.parse(text));
}

export async function scrapeZap(query: string): Promise<LivePrice[]> {
  // ── Endpoint 1: api.zap.co.il internal search ─────────────────────────────
  try {
    const results = await tryEndpoint(ZAP_EP1(query));
    if (results.length) {
      logger.info(`[ZAP] Scrape complete via endpoint 1`, { query, found: results.length });
      return results.sort((a, b) => a.price - b.price).slice(0, 5);
    }
  } catch (e) {
    logger.warn("[ZAP] Endpoint 1 failed", { err: String(e) });
  }

  // ── Endpoint 2: www.zap.co.il/api/search ─────────────────────────────────
  try {
    const results = await tryEndpoint(ZAP_EP2(query));
    if (results.length) {
      logger.info(`[ZAP] Scrape complete via endpoint 2`, { query, found: results.length });
      return results.sort((a, b) => a.price - b.price).slice(0, 5);
    }
  } catch (e) {
    logger.warn("[ZAP] Endpoint 2 failed", { err: String(e) });
  }

  logger.warn("[ZAP] All endpoints failed", { query });
  return [];
}
