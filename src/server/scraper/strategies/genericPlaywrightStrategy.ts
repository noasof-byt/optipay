/**
 * Generic Cheerio Strategy (formerly Playwright)
 *
 * Playwright has been removed. This strategy now uses fetch + Cheerio
 * to scrape club benefit pages that deliver server-side rendered HTML.
 *
 * Expected selectorConfig shape:
 * {
 *   storeName:       ".some-css-selector",
 *   discountText:    ".some-css-selector",
 *   restrictionText: ".some-css-selector",  // optional
 *   paginationNext:  ".next-btn",           // optional — not supported in cheerio mode
 * }
 */

import * as cheerio from "cheerio";
import { parseBenefits, ParsedBenefit } from "../parsers/benefitParser";
import { logger } from "@/lib/logger";

export interface GenericSelectorConfig {
  storeName:        string;
  discountText:     string;
  restrictionText?: string;
  paginationNext?:  string;
}

const FETCH_HEADERS: Record<string, string> = {
  "User-Agent":      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept":          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "he-IL,he;q=0.9,en-US;q=0.8",
  "Accept-Encoding": "gzip, deflate, br",
};

export async function runGenericPlaywrightStrategy(
  targetUrl: string,
  selectorConfig: GenericSelectorConfig
): Promise<ParsedBenefit[]> {
  try {
    const res = await fetch(targetUrl, {
      headers: FETCH_HEADERS,
      signal:  AbortSignal.timeout(20_000),
    });

    if (!res.ok) {
      logger.warn("Club scrape HTTP error", { status: res.status, url: targetUrl });
      return [];
    }

    const html = await res.text();
    const $    = cheerio.load(html);
    const allRaw: Array<{ storeName: string; rawText: string }> = [];

    const storeEls    = $(selectorConfig.storeName).toArray();
    const discountEls = $(selectorConfig.discountText).toArray();
    const restrictEls = selectorConfig.restrictionText
      ? $(selectorConfig.restrictionText).toArray()
      : [];

    const count = Math.min(storeEls.length, discountEls.length);

    for (let i = 0; i < count; i++) {
      const storeName      = $(storeEls[i]).text().trim();
      const discountText   = $(discountEls[i]).text().trim();
      const restrictionText = restrictEls[i] ? $(restrictEls[i]).text().trim() : "";

      if (!storeName) continue;

      allRaw.push({
        storeName,
        rawText: `${discountText} ${restrictionText}`.trim(),
      });
    }

    logger.info("Generic Cheerio strategy complete", { count: allRaw.length, url: targetUrl });
    return parseBenefits(allRaw);

  } catch (err) {
    logger.warn("Generic Cheerio strategy failed", { url: targetUrl, err: String(err) });
    return [];
  }
}
