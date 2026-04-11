/**
 * Generic Cheerio Strategy
 *
 * Fast scraper for server-rendered benefit tables.
 *
 * Expected selectorConfig shape:
 * {
 *   rowSelector:      "table.benefits tr",
 *   storeSelector:    "td.store-name",
 *   benefitSelector:  "td.benefit-text",
 *   nextPageSelector:  "a.next",   // optional
 * }
 */

import { extractAllPages } from "../engine/cheerioEngine";
import { parseBenefits, ParsedBenefit } from "../parsers/benefitParser";
import { logger } from "@/lib/logger";

export interface CheerioSelectorConfig {
  rowSelector:      string;
  storeSelector:    string;
  benefitSelector:  string;
  nextPageSelector?: string;
}

export async function runGenericCheerioStrategy(
  targetUrl: string,
  selectorConfig: CheerioSelectorConfig
): Promise<ParsedBenefit[]> {
  const rows = await extractAllPages(
    targetUrl,
    selectorConfig.rowSelector,
    selectorConfig.storeSelector,
    selectorConfig.benefitSelector,
    selectorConfig.nextPageSelector ?? null
  );

  logger.info("Generic Cheerio strategy complete", { count: rows.length, url: targetUrl });
  return parseBenefits(rows);
}
