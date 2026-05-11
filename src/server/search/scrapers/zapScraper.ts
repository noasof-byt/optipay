import "server-only";
/**
 * ZAP (zap.co.il) Price Scraper
 *
 * Fetches /search.aspx?keyword=QUERY&sog=a with browser headers, then
 * tries CSS selectors in order. Falls back to regex extraction if all
 * selectors return 0 items.
 *
 * NO Playwright — fetch + cheerio only (Vercel serverless constraint).
 */

import * as cheerio from "cheerio";
import { LivePrice }  from "@/types/search";
import { logger }     from "@/lib/logger";

const ZAP_BASE = "https://www.zap.co.il";
const ZAP_SEARCH = (q: string) =>
  `${ZAP_BASE}/search.aspx?keyword=${encodeURIComponent(q)}&sog=a`;

const BROWSER_HEADERS: Record<string, string> = {
  "User-Agent":      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept":          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "he-IL,he;q=0.9",
  "Accept-Encoding": "gzip, deflate, br",
  "Connection":      "keep-alive",
  "Cache-Control":   "max-age=0",
  "Upgrade-Insecure-Requests": "1",
};

const CANDIDATE_SELECTORS = [
  ".category-item",
  ".it-nm",
  "[class*='product-item']",
  "[class*='CatItem']",
  "[class*='zap-item']",
] as const;

export async function scrapeZap(query: string): Promise<LivePrice[]> {
  try {
    const url = ZAP_SEARCH(query);
    logger.info("[ZAP] Fetching", { url });

    const res = await fetch(url, {
      headers:  BROWSER_HEADERS,
      signal:   AbortSignal.timeout(15_000),
      redirect: "follow",
    });

    if (!res.ok) {
      logger.warn(`[ZAP] HTTP error: ${res.status}`);
      return [];
    }

    const html = await res.text();
    logger.info(`[ZAP] HTML length: ${html.length}`);
    // Log first 3000 chars for structure diagnosis
    logger.info(`[ZAP] HTML preview: ${html.slice(0, 3000)}`);

    const $ = cheerio.load(html);
    // Remove sponsored / promoted zones before iterating
    $("#TopItems, .TopItems, .sponsored, .promoted, .adBanner").remove();

    const results: LivePrice[] = [];
    let foundViaSelector = false;

    // ── Try CSS selectors in order ─────────────────────────────────────────
    for (const sel of CANDIDATE_SELECTORS) {
      const count = $(sel).length;
      logger.info(`[ZAP] Selector "${sel}" → ${count} items`);
      if (count === 0) continue;

      $(sel).each((_, el) => {
        const card = $(el);

        // Extract price from nested price elements, fall back to card text
        const priceText =
          card.find(".price-container .price, .item-price, [class*='price'], .prc").first().text().trim() ||
          card.text().trim();

        const priceMatch = priceText.match(/[\d,]+/);
        const price = priceMatch ? parseFloat(priceMatch[0].replace(/,/g, "")) : 0;
        if (!price || price < 10 || price > 1_000_000) return;

        const href    = card.find("a[href]").first().attr("href") ?? "";
        const fullUrl = href.startsWith("http") ? href : href ? `${ZAP_BASE}${href}` : url;

        results.push({
          storeName: "ZAP",
          price,
          currency:  "ILS",
          url:       fullUrl,
          inStock:   true,
          source:    "zap",
          fetchedAt: new Date(),
        });
      });

      if (results.length > 0) {
        foundViaSelector = true;
        break;
      }
    }

    // ── Regex fallback when all selectors return 0 ─────────────────────────
    if (!foundViaSelector || results.length === 0) {
      logger.info("[ZAP] All selectors returned 0 — falling back to regex extraction");

      const priceMatches: number[] = [];

      // Try JSON "price" fields first
      for (const m of html.matchAll(/"price"\s*:\s*"?(\d+)"?/g)) {
        const p = parseFloat(m[1]);
        if (p >= 10 && p <= 1_000_000) priceMatches.push(p);
      }

      // Fall back to ₪ symbol
      if (!priceMatches.length) {
        for (const m of html.matchAll(/₪\s*([\d,]+)/g)) {
          const p = parseFloat(m[1].replace(/,/g, ""));
          if (p >= 10 && p <= 1_000_000) priceMatches.push(p);
        }
      }

      logger.info(`[ZAP] Regex found ${priceMatches.length} prices`);

      // Deduplicate and take cheapest 5
      const unique = [...new Set(priceMatches)].sort((a, b) => a - b).slice(0, 5);
      for (const price of unique) {
        results.push({
          storeName: "ZAP",
          price,
          currency:  "ILS",
          url,
          inStock:   true,
          source:    "zap",
          fetchedAt: new Date(),
        });
      }
    }

    logger.info(`[ZAP] Scrape complete`, { query, found: results.length });
    return results.sort((a, b) => a.price - b.price).slice(0, 5);

  } catch (err) {
    logger.warn("[ZAP] Scraper failed", { err: String(err) });
    return [];
  }
}
