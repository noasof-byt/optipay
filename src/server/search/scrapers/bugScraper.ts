import "server-only";
/**
 * Bug (bug.co.il) Real-Time Price Scraper
 *
 * Anti-bot bypass strategy:
 *   Bug uses a standard Cloudflare "Bot Fight Mode" configuration that
 *   challenges requests missing proper browser fingerprint headers.
 *
 *   Their search results are delivered as server-side HTML — the products,
 *   names, and prices are embedded directly in the initial HTML response.
 *   Cloudflare's CF config does not enable JS challenge mode for this path,
 *   so sending a full set of browser-like headers is sufficient.
 *
 *   Correct search URL (discovered 2026-03): /search?q=QUERY
 *   (The old /catalog/search?search_text= URL returns 404)
 *
 * HTML structure (confirmed from live HTML, 2026-03):
 *   Each product card is an <a class="... product-cube-inner-2 tpurl" href="...">
 *     <span class="c1">Product Name</span>
 *     <span class="c2"><del>old ₪</del><span>current ₪</span></span>
 *   </a>
 */

import * as cheerio from "cheerio";
import { LivePrice }  from "@/types/search";
import { logger }     from "@/lib/logger";

const BUG_BASE = "https://www.bug.co.il";

// Correct search URL — /search?q= (not /catalog/search?search_text=)
const BUG_SEARCH_URL = (q: string) =>
  `${BUG_BASE}/search?q=${encodeURIComponent(q)}`;

// Full browser-like header set — must be consistent (UA ↔ sec-ch-ua ↔ platform)
const BROWSER_HEADERS: Record<string, string> = {
  "User-Agent":         "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept":             "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language":    "he-IL,he;q=0.9,en-US;q=0.8,en;q=0.7",
  "Accept-Encoding":    "gzip, deflate, br",
  "sec-ch-ua":          '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
  "sec-ch-ua-mobile":   "?0",
  "sec-ch-ua-platform": '"Windows"',
  "sec-fetch-dest":     "document",
  "sec-fetch-mode":     "navigate",
  "sec-fetch-site":     "none",
  "sec-fetch-user":     "?1",
  "Upgrade-Insecure-Requests": "1",
  "Cache-Control":      "max-age=0",
  "Connection":         "keep-alive",
};

// ── CSS selectors (confirmed from live HTML, March 2026) ──────────────────────
// Each product card is the <a> element itself — it carries both the href
// (product URL) and contains the name (.c1) and price (.c2) spans.
const SEL = {
  productCard: "a.product-cube-inner-2.tpurl",  // the card IS the link
  productName: "span.c1",
  // .c2 contains: <del>old price</del><span>CURRENT PRICE</span>
  // We read the inner <span> to get the current (non-strikethrough) price.
  currentPrice: "span.c2 span",
} as const;

// ─────────────────────────────────────────────────────────────────────────────

export async function scrapeBug(query: string): Promise<LivePrice[]> {
  try {
    const url = BUG_SEARCH_URL(query);
    logger.info("Bug HTML request", { url });

    const res = await fetch(url, {
      headers:  BROWSER_HEADERS,
      signal:   AbortSignal.timeout(15_000),
      redirect: "follow",
    });

    if (!res.ok) {
      logger.warn("Bug HTTP error", { status: res.status });
      return [];
    }

    const html = await res.text();

    // Detect CF challenge — don't parse it as product data
    if (
      html.includes("cf-browser-verification") ||
      html.includes("Just a moment...") ||
      html.includes("_cf_chl_")
    ) {
      logger.warn("Bug: Cloudflare challenge page received — skipping");
      return [];
    }

    const $       = cheerio.load(html);
    const results: LivePrice[] = [];

    $(SEL.productCard).each((_, el) => {
      const card = $(el);

      const name = card.find(SEL.productName).first().text().trim();
      if (!name) return;

      // Current price is in the inner <span> of .c2 (the <del> is the old price)
      const priceText = card.find(SEL.currentPrice).first().text().trim();
      const price     = parseBugPrice(priceText);
      if (!price) return;

      const href    = card.attr("href") ?? "";
      const fullUrl = href.startsWith("http") ? href : `${BUG_BASE}${href}`;

      results.push({
        storeName: "Bug",
        price,
        currency:  "ILS",
        url:       fullUrl,
        inStock:   true,
        source:    "bug",
        fetchedAt: new Date(),
      });
    });

    logger.info("Bug scrape complete", { query, found: results.length });
    return results.slice(0, 5);

  } catch (err) {
    logger.warn("Bug scraper failed", { err: String(err) });
    return [];
  }
}

function parseBugPrice(raw: string): number | null {
  // Strips ₪, ש"ח, commas, spaces — leaves digits and decimal point
  const cleaned = raw.replace(/[₪\s,]/g, "").replace(/ש["׳]ח/g, "");
  const num = parseFloat(cleaned);
  return isNaN(num) || num <= 0 ? null : num;
}
