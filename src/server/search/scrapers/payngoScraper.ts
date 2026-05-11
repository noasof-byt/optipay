import "server-only";
/**
 * Payngo / מחסני החשמל (payngo.co.il) Price Scraper
 *
 * Tries three endpoints in order:
 *   1. Shopify suggest.json  /search/suggest.json
 *   2. Shopify products.json /collections/all/products.json
 *   3. HTML scrape           /search?type=product&q=...
 *
 * NO Playwright — fetch + cheerio only (Vercel serverless constraint).
 */

import * as cheerio  from "cheerio";
import { LivePrice } from "@/types/search";
import { logger }    from "@/lib/logger";

const PAYNGO_BASE = "https://www.payngo.co.il";

const MOBILE_HEADERS: Record<string, string> = {
  "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1",
  "Accept":     "application/json",
};

const BROWSER_HEADERS: Record<string, string> = {
  "User-Agent":      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept":          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "he-IL,he;q=0.9",
};

export async function scrapePayngo(query: string): Promise<LivePrice[]> {
  const encodedQuery = encodeURIComponent(query);

  // ── Endpoint 1: Shopify suggest.json ─────────────────────────────────────
  const ep1 = `${PAYNGO_BASE}/search/suggest.json?q=${encodedQuery}&resources[type]=product&resources[limit]=5`;
  logger.info("[PAYNGO] Trying endpoint 1 (suggest.json)", { url: ep1 });
  try {
    const res = await fetch(ep1, { headers: MOBILE_HEADERS, signal: AbortSignal.timeout(10_000) });
    logger.info(`[PAYNGO] Status: ${res.status}`);
    if (res.ok) {
      const text = await res.text();
      logger.info(`[PAYNGO] Response preview: ${text.slice(0, 300)}`);
      const data = JSON.parse(text);
      const products: Record<string, unknown>[] = data?.resources?.results?.products ?? [];
      if (products.length) {
        // Shopify suggest prices are in cents (e.g. "109000" = ₪1090)
        return products.slice(0, 5).map((p) => ({
          storeName: "מחסני החשמל",
          price:     Number(p.price ?? 0) / 100,
          currency:  "ILS",
          url:       `${PAYNGO_BASE}${p.url ?? ""}`,
          inStock:   true,
          source:    "payngo" as const,
          fetchedAt: new Date(),
        })).filter((r) => r.price >= 10 && r.price <= 1_000_000);
      }
    }
  } catch (e) {
    logger.warn("[PAYNGO] Endpoint 1 failed", { err: String(e) });
  }

  // ── Endpoint 2: Shopify products.json ────────────────────────────────────
  const ep2 = `${PAYNGO_BASE}/collections/all/products.json?limit=5&q=${encodedQuery}`;
  logger.info("[PAYNGO] Trying endpoint 2 (products.json)", { url: ep2 });
  try {
    const res = await fetch(ep2, { headers: MOBILE_HEADERS, signal: AbortSignal.timeout(10_000) });
    logger.info(`[PAYNGO] Status: ${res.status}`);
    if (res.ok) {
      const text = await res.text();
      logger.info(`[PAYNGO] Response preview: ${text.slice(0, 300)}`);
      const data = JSON.parse(text);
      const products: Record<string, unknown>[] = data?.products ?? [];
      if (products.length) {
        return products.slice(0, 5).map((p) => {
          const variants = (p.variants as Record<string, unknown>[] | undefined) ?? [];
          const price = variants[0] ? Number((variants[0] as Record<string, unknown>).price ?? 0) : 0;
          return {
            storeName: "מחסני החשמל",
            price,
            currency:  "ILS",
            url:       `${PAYNGO_BASE}/products/${p.handle ?? ""}`,
            inStock:   true,
            source:    "payngo" as const,
            fetchedAt: new Date(),
          };
        }).filter((r) => r.price >= 10 && r.price <= 1_000_000);
      }
    }
  } catch (e) {
    logger.warn("[PAYNGO] Endpoint 2 failed", { err: String(e) });
  }

  // ── Endpoint 3: HTML scrape ───────────────────────────────────────────────
  const ep3 = `${PAYNGO_BASE}/search?type=product&q=${encodedQuery}`;
  logger.info("[PAYNGO] Trying endpoint 3 (HTML scrape)", { url: ep3 });
  try {
    const res = await fetch(ep3, { headers: BROWSER_HEADERS, signal: AbortSignal.timeout(15_000) });
    logger.info(`[PAYNGO] Status: ${res.status}`);
    if (res.ok) {
      const html = await res.text();
      logger.info(`[PAYNGO] Response preview: ${html.slice(0, 300)}`);
      const $ = cheerio.load(html);
      const results: LivePrice[] = [];

      // Try embedded <script type="application/json"> product data
      $("script[type='application/json']").each((_, el) => {
        if (results.length >= 5) return;
        try {
          const data = JSON.parse($(el).html() ?? "");
          const products: Record<string, unknown>[] = data?.products ?? data?.items ?? [];
          for (const p of products.slice(0, 5)) {
            const price = Number(p.price ?? 0);
            if (price >= 10 && price <= 1_000_000) {
              results.push({
                storeName: "מחסני החשמל",
                price,
                currency:  "ILS",
                url:       String(p.url ?? (p.handle ? `${PAYNGO_BASE}/products/${p.handle}` : PAYNGO_BASE)),
                inStock:   true,
                source:    "payngo",
                fetchedAt: new Date(),
              });
            }
          }
        } catch { /* skip */ }
      });

      if (results.length) return results.slice(0, 5);

      // Try CSS product selectors
      for (const sel of [".product-item", ".grid-item", "[class*='product']"]) {
        $(sel).each((_, el) => {
          if (results.length >= 5) return;
          const card       = $(el);
          const priceText  = card.find("[class*='price']").first().text();
          const priceMatch = priceText.match(/[\d,]+/);
          const price      = priceMatch ? parseFloat(priceMatch[0].replace(/,/g, "")) : 0;
          if (!price || price < 10 || price > 1_000_000) return;
          const href    = card.find("a[href]").first().attr("href") ?? "";
          const fullUrl = href.startsWith("http") ? href : `${PAYNGO_BASE}${href}`;
          results.push({
            storeName: "מחסני החשמל",
            price,
            currency:  "ILS",
            url:       fullUrl,
            inStock:   true,
            source:    "payngo",
            fetchedAt: new Date(),
          });
        });
        if (results.length) break;
      }

      if (results.length) return results.slice(0, 5);
    }
  } catch (e) {
    logger.warn("[PAYNGO] Endpoint 3 failed", { err: String(e) });
  }

  logger.warn("[PAYNGO] All endpoints failed");
  return [];
}
