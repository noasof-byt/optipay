import "server-only";
/**
 * ZAP (zap.co.il) Price Scraper
 *
 * URL: /search.aspx?keyword=QUERY&sog=a
 * Tries three CSS selectors in order until one yields results.
 * Skips sponsored/promoted/adBanner elements.
 * Logs every step; logs first 500 chars of HTML when 0 results.
 */

import * as cheerio from "cheerio";
import { RawResult } from "@/lib/search/types";

const ZAP_BASE   = "https://www.zap.co.il";
const SEARCH_URL = (q: string) =>
  `${ZAP_BASE}/search.aspx?keyword=${encodeURIComponent(q)}&sog=a`;

const BROWSER_HEADERS: Record<string, string> = {
  "User-Agent":         "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept":             "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language":    "he-IL,he;q=0.9",
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

// Try these selectors in order — first that yields items wins
const CANDIDATE_SELECTORS = [
  ".category-item",
  ".items-view .item",
  "[data-zap-section='products'] .item",
] as const;

const SKIP_CLASSES = new Set(["sponsored", "TopItems", "adBanner"]);

function extractFromSelector($: cheerio.CheerioAPI, selector: string): RawResult[] {
  const results: RawResult[] = [];

  $(selector).each((_, el) => {
    const item = $(el);

    // Skip sponsored / promoted elements
    const classes = (item.attr("class") ?? "").split(/\s+/);
    if (classes.some((c) => SKIP_CLASSES.has(c))) return;
    if (item.closest(".sponsored, .TopItems, .adBanner").length) return;

    const name = (
      item.find(".title a, .item-name a, h3 a, h2 a, .name a").first().text().trim() ||
      item.find("a").first().text().trim()
    );
    if (!name) return;

    const priceText = (
      item.find(".price-container .price, .item-price, [class*='price']").first().text() ||
      item.find(".price").first().text()
    );
    const price = parseFloat(priceText.replace(/[^0-9.]/g, ""));
    if (!price || price <= 0 || price > 1_000_000) return;

    const rawHref    = item.find("a").first().attr("href") ?? "";
    const productUrl = rawHref.startsWith("http") ? rawHref : `${ZAP_BASE}${rawHref}`;
    const imageUrl   = item.find("img").first().attr("src") ?? "";

    results.push({
      store:         "zap",
      storeName:     "ZAP",
      productName:   name,
      originalPrice: price,
      imageUrl,
      productUrl,
    });
  });

  return results;
}

export async function scrapeZap(query: string): Promise<RawResult[]> {
  try {
    const url = SEARCH_URL(query);
    console.log(`[ZAP] Fetching URL: ${url}`);

    const res = await fetch(url, {
      headers:  BROWSER_HEADERS,
      signal:   AbortSignal.timeout(15_000),
      redirect: "follow",
    });

    if (!res.ok) {
      console.log(`[ZAP] HTTP error: ${res.status}`);
      return [];
    }

    const html = await res.text();
    console.log(`[ZAP] HTML length: ${html.length}`);

    if (
      html.includes("cf-browser-verification") ||
      html.includes("Just a moment...") ||
      html.includes("_cf_chl_")
    ) {
      console.log("[ZAP] Cloudflare challenge detected — skipping");
      return [];
    }

    const $ = cheerio.load(html);

    // Remove promoted / sponsored zones before iterating
    $("#TopItems, .TopItems, .sponsored, .promoted, .adBanner").remove();

    let results: RawResult[] = [];

    for (const selector of CANDIDATE_SELECTORS) {
      const rawCount = $(selector).length;
      console.log(`[ZAP] Found ${rawCount} raw items with selector "${selector}"`);

      if (rawCount === 0) continue;

      results = extractFromSelector($, selector);
      console.log(`[ZAP] After filter: ${results.length} items`);

      if (results.length > 0) break;
    }

    if (results.length === 0) {
      console.log(`[ZAP] 0 results for query "${query}". HTML preview: ${html.slice(0, 500)}`);
      return [];
    }

    console.log(`[ZAP] Fetched ${results.length} results for query: ${query}`);
    return results.sort((a, b) => a.originalPrice - b.originalPrice).slice(0, 5);

  } catch (err) {
    console.error(`[ZAP] ERROR: ${err instanceof Error ? err.message : String(err)}`);
    return [];
  }
}
