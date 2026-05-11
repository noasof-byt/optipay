/**
 * Live Price Fetcher
 *
 * Fans out to all four direct-HTTP scrapers in parallel, deduplicates
 * results by store, and returns a sorted list of LivePrice objects.
 *
 * Each scraper follows the same pattern as bugScraper: direct HTTP fetch
 * to the target store, no third-party search engines.
 *
 * Stores and their domains:
 *   Bug    — bug.co.il
 *   KSP    — ksp.co.il
 *   ZAP    — zap.co.il  (price comparison; lowPrice from model JSON-LD)
 *   Payngo — payngo.co.il  (מחסני החשמל)
 *
 * Parallelism: all scrapers run concurrently with a 25s hard timeout.
 * A single scraper failure never blocks results from the others.
 */

import { LivePrice }    from "@/types/search";
import { NlpResult }    from "../nlp/hebrewNormalizer";
import { scrapeBug }    from "./bugScraper";
import { scrapeKsp }    from "./kspScraper";
import { scrapeZap }    from "./zapScraper";
import { scrapePayngo } from "./payngoScraper";
import { logger }       from "@/lib/logger";

const SCRAPER_TIMEOUT_MS = 25_000;

export interface FetchResult {
  prices: LivePrice[];
  errors: string[];
}

export async function fetchLivePrices(nlp: NlpResult): Promise<FetchResult> {
  const errors: string[] = [];

  const safeRun = async (
    name: string,
    fn:   () => Promise<LivePrice[]>,
  ): Promise<LivePrice[]> => {
    try {
      return await Promise.race([
        fn(),
        new Promise<LivePrice[]>((_, reject) =>
          setTimeout(() => reject(new Error("timeout")), SCRAPER_TIMEOUT_MS)
        ),
      ]);
    } catch (err) {
      const msg = `${name}: ${err instanceof Error ? err.message : String(err)}`;
      logger.warn("Scraper failed", { scraper: name, err: msg });
      errors.push(msg);
      return [];
    }
  };

  // All four scrapers use the Hebrew query — Israeli stores index in Hebrew
  const query = nlp.hebrewQuery ?? nlp.canonicalQuery;

  const [bugPrices, kspPrices, zapPrices, payngoPrices] = await Promise.all([
    safeRun("Bug",    () => scrapeBug(nlp.canonicalQuery)),
    safeRun("KSP",    () => scrapeKsp(query)),
    safeRun("ZAP",    () => scrapeZap(query)),
    safeRun("Payngo", () => scrapePayngo(query)),
  ]);

  const all = [...bugPrices, ...kspPrices, ...zapPrices, ...payngoPrices];

  // ── Deduplicate: keep cheapest price per store ────────────────────────────
  const byStore = new Map<string, LivePrice>();
  for (const price of all) {
    const key      = price.storeName.trim().toLowerCase();
    const existing = byStore.get(key);
    if (!existing || price.price < existing.price) {
      byStore.set(key, price);
    }
  }

  // ── Filter out-of-stock and suspicious prices ─────────────────────────────
  const filtered = Array.from(byStore.values()).filter(
    (p) => p.inStock && p.price > 1 && p.price < 1_000_000
  );

  filtered.sort((a, b) => a.price - b.price);

  logger.info("Live price fetch complete", {
    raw:    all.length,
    unique: byStore.size,
    valid:  filtered.length,
    errors: errors.length,
  });

  return { prices: filtered, errors };
}
