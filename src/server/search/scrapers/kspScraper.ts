/**
 * KSP (ksp.co.il) Real-Time Price Scraper
 *
 * Anti-bot bypass strategy:
 *   KSP's website sits behind Cloudflare. Direct API calls to their mobile
 *   API (m.ksp.co.il) fail because the subdomain is unreachable externally,
 *   and hitting the API endpoints on the main domain returns 404 without
 *   session cookies.
 *
 *   Solution — Playwright route interception:
 *   1. Load ksp.co.il/web/cat/?q=QUERY in the stealth browser (passes CF)
 *   2. Register a route handler BEFORE navigation that intercepts the XHR
 *      call KSP's React SPA makes to /m_action/api/item/search
 *   3. The browser context already has valid CF cookies from the page load,
 *      so the intercepted API call succeeds and returns clean JSON
 *   4. We resolve a Promise with the JSON payload and close the page
 *
 *   Fallback: If the XHR never fires (page structure change, CF block),
 *   scrape product cards from the rendered DOM.
 */

import type { Page }   from "playwright";
import { LivePrice }   from "@/types/search";
import { logger }      from "@/lib/logger";
import {
  acquirePage,
  releasePage,
  navigateTo,
  scrollToBottom,
} from "../../scraper/engine/playwrightEngine";

const KSP_BASE = "https://ksp.co.il";

// KSP's React SPA navigates to this URL for category/search results
const KSP_SEARCH_PAGE = (q: string) =>
  `${KSP_BASE}/web/cat/?q=${encodeURIComponent(q)}`;

// The XHR endpoint the SPA calls — intercepted in the browser context
// (the browser has cookies; direct Node.js fetch to this URL returns 404)
const KSP_API_PATTERN = "**/m_action/api/item/search**";

// DOM selectors used in the fallback scrape
const SEL = {
  productCard:  ".ProductCard, .product-item, [class*='ProductCard'], [class*='product-card']",
  productName:  "h2, h3, .ProductName, [class*='product-name'], [class*='ProductName']",
  productPrice: "[class*='price'], [class*='Price'], .ProductPrice, .PriceNumber",
  productLink:  "a[href*='/web/item/']",
};

// ── Types returned by KSP's internal API ──────────────────────────────────────

interface KspApiRow {
  uin:      string;   // item ID → /web/item/{uin}
  sn:       string;   // product name
  price:    string;   // "3499"
  img?:     string;
  inStock?: number;   // 1 = in stock
  dc?:      string;
}

interface KspApiResponse {
  data?: { total?: number; rows?: KspApiRow[] };
  rows?: KspApiRow[];
  total?: number;
}

// ─────────────────────────────────────────────────────────────────────────────

export async function scrapeKsp(query: string): Promise<LivePrice[]> {
  const page = await acquirePage();

  try {
    // ── Set up XHR interception before navigation ─────────────────────────
    let resolveApi!: (data: KspApiResponse) => void;
    const apiPromise = new Promise<KspApiResponse>((res) => { resolveApi = res; });

    await page.route(KSP_API_PATTERN, async (route) => {
      try {
        const response = await route.fetch();
        const json: KspApiResponse = await response.json().catch(() => ({}));
        resolveApi(json);
        await route.fulfill({ response });
      } catch {
        await route.continue();
      }
    });

    // ── Navigate (passes Cloudflare because of stealth browser) ───────────
    logger.info("KSP: navigating to search page", { query });
    await navigateTo(page, KSP_SEARCH_PAGE(query));

    // Wait up to 12 s for the XHR to fire, then fall back to DOM scrape
    const apiData = await Promise.race([
      apiPromise,
      new Promise<null>((res) => setTimeout(() => res(null), 12_000)),
    ]);

    if (apiData) {
      const rows: KspApiRow[] = apiData?.data?.rows ?? apiData?.rows ?? [];
      if (rows.length) {
        logger.info("KSP: XHR intercepted", { query, rows: rows.length });
        return parseApiRows(rows);
      }
    }

    // ── Fallback: scrape rendered DOM ─────────────────────────────────────
    logger.info("KSP: XHR not captured — falling back to DOM scrape", { query });
    await scrollToBottom(page);
    return await scrapeDom(page);

  } catch (err) {
    logger.warn("KSP scraper failed", { err: String(err) });
    return [];
  } finally {
    await releasePage(page);
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseApiRows(rows: KspApiRow[]): LivePrice[] {
  return rows
    .slice(0, 5)
    .map((row): LivePrice | null => {
      const price = parseKspPrice(row.price);
      if (!price) return null;

      return {
        storeName: "KSP",
        price,
        currency:  "ILS",
        url:       row.uin ? `${KSP_BASE}/web/item/${row.uin}` : KSP_BASE,
        inStock:   row.inStock !== 0,
        source:    "ksp",
        fetchedAt: new Date(),
      };
    })
    .filter((r): r is LivePrice => r !== null);
}

async function scrapeDom(page: Page): Promise<LivePrice[]> {
  const results: LivePrice[] = [];
  const cards = await page.$$(SEL.productCard);

  for (const card of cards.slice(0, 5)) {
    try {
      const nameEl  = await card.$(SEL.productName);
      const priceEl = await card.$(SEL.productPrice);
      const linkEl  = await card.$(SEL.productLink);

      if (!nameEl || !priceEl) continue;

      const price = parseKspPrice(await priceEl.innerText());
      if (!price) continue;

      const href = linkEl ? (await linkEl.getAttribute("href") ?? "") : "";
      const url  = href.startsWith("http") ? href : `${KSP_BASE}${href}`;

      results.push({
        storeName: "KSP",
        price,
        currency:  "ILS",
        url:       url || KSP_BASE,
        inStock:   true,
        source:    "ksp",
        fetchedAt: new Date(),
      });
    } catch { /* skip bad row */ }
  }

  logger.info("KSP DOM scrape complete", { found: results.length });
  return results;
}

function parseKspPrice(raw: string | number | undefined): number | null {
  if (raw === undefined || raw === null) return null;
  const cleaned = String(raw).replace(/[^\d.]/g, "");
  const num = parseFloat(cleaned);
  return isNaN(num) || num <= 0 ? null : num;
}
