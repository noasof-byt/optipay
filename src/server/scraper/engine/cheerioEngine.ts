/**
 * Cheerio Engine — fast HTML scraping without a full browser.
 *
 * Used for sites that render their benefit tables server-side (no JS needed).
 * Falls back to Playwright via the caller if the page returns an empty result.
 */

import * as cheerio from "cheerio";
import { logger } from "@/lib/logger";

const DEFAULT_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
  "Accept":
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
  "Accept-Language": "he-IL,he;q=0.9,en-US;q=0.8",
  "Accept-Encoding": "gzip, deflate, br",
  "Connection":      "keep-alive",
  "Upgrade-Insecure-Requests": "1",
};

export interface CheerioRow {
  storeName: string;
  rawText:   string;
}

/**
 * Fetch a URL and return a Cheerio root for parsing.
 */
export async function fetchPage(url: string): Promise<cheerio.CheerioAPI> {
  const res = await fetch(url, {
    headers: DEFAULT_HEADERS,
    signal:  AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} fetching ${url}`);
  }

  const html = await res.text();
  return cheerio.load(html);
}

/**
 * Generic row extractor — reads a table or list given column selectors.
 *
 * @param $ - loaded Cheerio root
 * @param rowSelector     - CSS selector for each benefit row
 * @param storeSelector   - CSS selector (within each row) for the store name
 * @param benefitSelector - CSS selector (within each row) for the benefit text
 */
export function extractRows(
  $: cheerio.CheerioAPI,
  rowSelector:     string,
  storeSelector:   string,
  benefitSelector: string
): CheerioRow[] {
  const rows: CheerioRow[] = [];

  $(rowSelector).each((_, el) => {
    const row       = $(el);
    const storeName = row.find(storeSelector).text().trim();
    const rawText   = row.find(benefitSelector).text().trim();
    if (storeName) rows.push({ storeName, rawText });
  });

  return rows;
}

/**
 * Handle pagination: scrape multiple pages until `nextSelector` disappears.
 * Returns a flat array of all rows collected.
 */
export async function extractAllPages(
  url: string,
  rowSelector:     string,
  storeSelector:   string,
  benefitSelector: string,
  nextSelector:    string | null,
  maxPages = 20
): Promise<CheerioRow[]> {
  const allRows: CheerioRow[] = [];
  let currentUrl = url;
  let page = 1;

  while (page <= maxPages) {
    logger.debug("Cheerio fetching page", { page, url: currentUrl });

    const $ = await fetchPage(currentUrl);
    const rows = extractRows($, rowSelector, storeSelector, benefitSelector);
    allRows.push(...rows);

    if (!nextSelector) break;

    // Try to find a "next" link
    const nextEl = $(nextSelector);
    if (!nextEl.length) break;

    const href = nextEl.attr("href");
    if (!href) break;

    // Build absolute URL
    currentUrl = href.startsWith("http")
      ? href
      : new URL(href, url).toString();

    page++;
  }

  logger.info("Cheerio extraction complete", {
    totalRows: allRows.length,
    pages: page,
  });

  return allRows;
}
