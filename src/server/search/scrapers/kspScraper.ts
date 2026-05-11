import "server-only";
/**
 * KSP (ksp.co.il) Price Scraper
 *
 * Tries three endpoints in order:
 *   1. Mobile JSON API  /app/api/search
 *   2. HTML page        /web/cat/search  → __NEXT_DATA__ or __INITIAL_STATE__
 *   3. Format param     /web/cat/search?format=json
 *
 * NO Playwright — fetch + cheerio only (Vercel serverless constraint).
 */

import * as cheerio from "cheerio";
import { LivePrice }  from "@/types/search";
import { logger }     from "@/lib/logger";

const KSP_BASE = "https://ksp.co.il";

const MOBILE_HEADERS: Record<string, string> = {
  "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1",
  "Accept":     "application/json",
  "Referer":    "https://ksp.co.il/",
};

const BROWSER_HEADERS: Record<string, string> = {
  "User-Agent":      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept":          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "he-IL,he;q=0.9",
  "Referer":         "https://ksp.co.il/",
};

function extractProducts(data: unknown): LivePrice[] {
  const products =
    (data as Record<string, unknown>)?.products ??
    (data as Record<string, unknown>)?.items ??
    (data as Record<string, unknown>)?.results;
  if (!Array.isArray(products) || !products.length) return [];

  return (products as Record<string, unknown>[])
    .slice(0, 5)
    .map((p) => ({
      storeName: "KSP",
      price:     Number(p.price ?? p.Price ?? p.salePrice ?? 0),
      currency:  "ILS",
      url:       String(p.url ?? p.link ?? p.webUrl ?? `${KSP_BASE}/`),
      inStock:   true,
      source:    "ksp" as const,
      fetchedAt: new Date(),
    }))
    .filter((r) => r.price >= 10 && r.price <= 1_000_000);
}

export async function scrapeKsp(query: string): Promise<LivePrice[]> {
  const encodedQuery = encodeURIComponent(query);

  // ── Endpoint 1: Mobile JSON API ──────────────────────────────────────────
  const ep1 = `${KSP_BASE}/app/api/search?q=${encodedQuery}&from=0&size=5`;
  logger.info("[KSP] Trying endpoint 1 (mobile API)", { url: ep1 });
  try {
    const res = await fetch(ep1, { headers: MOBILE_HEADERS, signal: AbortSignal.timeout(10_000) });
    logger.info(`[KSP] Status: ${res.status}`);
    if (res.ok) {
      const text = await res.text();
      logger.info(`[KSP] Response preview: ${text.slice(0, 300)}`);
      const results = extractProducts(JSON.parse(text));
      if (results.length) return results;
    }
  } catch (e) {
    logger.warn("[KSP] Endpoint 1 failed", { err: String(e) });
  }

  // ── Endpoint 2: HTML → __NEXT_DATA__ / __INITIAL_STATE__ ────────────────
  const ep2 = `${KSP_BASE}/web/cat/search?q=${encodedQuery}`;
  logger.info("[KSP] Trying endpoint 2 (HTML scrape)", { url: ep2 });
  try {
    const res = await fetch(ep2, { headers: BROWSER_HEADERS, signal: AbortSignal.timeout(15_000) });
    logger.info(`[KSP] Status: ${res.status}`);
    if (res.ok) {
      const html = await res.text();
      logger.info(`[KSP] Response preview: ${html.slice(0, 300)}`);
      const $ = cheerio.load(html);

      // Try <script id="__NEXT_DATA__">
      const nextDataRaw = $("script#__NEXT_DATA__").html();
      if (nextDataRaw) {
        try {
          const nd = JSON.parse(nextDataRaw);
          const products =
            nd?.props?.pageProps?.products ??
            nd?.props?.pageProps?.items ??
            nd?.props?.pageProps?.searchResults?.products ??
            nd?.props?.pageProps?.data?.products ??
            nd?.props?.pageProps?.initialData?.items;
          const results = extractProducts({ products });
          if (results.length) return results;
        } catch (e) {
          logger.warn("[KSP] Failed to parse __NEXT_DATA__", { err: String(e) });
        }
      }

      // Try window.__INITIAL_STATE__ in any inline script
      for (const el of $("script:not([src])").toArray()) {
        const content = $(el).html() ?? "";
        if (!content.includes("__INITIAL_STATE__")) continue;
        const m = content.match(/__INITIAL_STATE__\s*=\s*(\{[\s\S]*?\});?\s*(?:window|var|\/\/)/);
        if (!m) continue;
        try {
          const state = JSON.parse(m[1]);
          const products =
            state?.catalog?.products ?? state?.products ?? state?.items ?? state?.data?.products;
          const results = extractProducts({ products });
          if (results.length) return results;
        } catch { /* skip */ }
      }
    }
  } catch (e) {
    logger.warn("[KSP] Endpoint 2 failed", { err: String(e) });
  }

  // ── Endpoint 3: format=json param ───────────────────────────────────────
  const ep3 = `${KSP_BASE}/web/cat/search?q=${encodedQuery}&format=json`;
  logger.info("[KSP] Trying endpoint 3 (format=json)", { url: ep3 });
  try {
    const res = await fetch(ep3, {
      headers: { ...BROWSER_HEADERS, "Accept": "application/json" },
      signal:  AbortSignal.timeout(10_000),
    });
    logger.info(`[KSP] Status: ${res.status}`);
    if (res.ok) {
      const text = await res.text();
      logger.info(`[KSP] Response preview: ${text.slice(0, 300)}`);
      const results = extractProducts(JSON.parse(text));
      if (results.length) return results;
    }
  } catch (e) {
    logger.warn("[KSP] Endpoint 3 failed", { err: String(e) });
  }

  logger.warn("[KSP] All endpoints failed");
  return [];
}
