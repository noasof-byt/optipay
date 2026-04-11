/**
 * Generic Playwright Strategy
 *
 * Used for any club whose `selectorConfig` follows the standard shape.
 * This strategy is the fallback when no club-specific strategy exists.
 *
 * Expected selectorConfig shape:
 * {
 *   storeName:      ".some-css-selector",
 *   discountText:   ".some-css-selector",
 *   restrictionText: ".some-css-selector",  // optional
 *   paginationNext:  ".next-btn",           // optional
 * }
 */

import {
  acquirePage,
  releasePage,
  navigateTo,
  scrollToBottom,
  extractTexts,
  clickNextPage,
} from "../engine/playwrightEngine";
import { parseBenefits, ParsedBenefit } from "../parsers/benefitParser";
import { logger } from "@/lib/logger";

export interface GenericSelectorConfig {
  storeName:        string;
  discountText:     string;
  restrictionText?: string;
  paginationNext?:  string;
}

export async function runGenericPlaywrightStrategy(
  targetUrl: string,
  selectorConfig: GenericSelectorConfig
): Promise<ParsedBenefit[]> {
  const page = await acquirePage();
  const allRaw: Array<{ storeName: string; rawText: string }> = [];

  try {
    await navigateTo(page, targetUrl);
    await scrollToBottom(page);

    let pageNum = 1;
    const MAX_PAGES = 30;

    while (pageNum <= MAX_PAGES) {
      logger.debug("Scraping page", { pageNum, url: page.url() });

      const storeNames = await extractTexts(page, selectorConfig.storeName);
      const discountTexts = await extractTexts(page, selectorConfig.discountText);

      // Merge store + discount text; if counts differ, zip what we have
      const count = Math.min(storeNames.length, discountTexts.length);
      for (let i = 0; i < count; i++) {
        const restrictionText = selectorConfig.restrictionText
          ? await page
              .$$eval(selectorConfig.restrictionText, (els, idx) =>
                (els[idx] as HTMLElement)?.innerText?.trim() ?? ""
              , i)
              .catch(() => "")
          : "";

        allRaw.push({
          storeName: storeNames[i],
          rawText:   `${discountTexts[i]} ${restrictionText}`.trim(),
        });
      }

      // Pagination
      if (!selectorConfig.paginationNext) break;
      const hasNext = await clickNextPage(page, selectorConfig.paginationNext);
      if (!hasNext) break;

      await scrollToBottom(page);
      pageNum++;
    }
  } finally {
    await releasePage(page);
  }

  logger.info("Generic Playwright strategy complete", { count: allRaw.length, url: targetUrl });
  return parseBenefits(allRaw);
}
