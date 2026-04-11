/**
 * Live Price Fetcher
 *
 * Fans out to all scrapers in parallel, deduplicates results by store,
 * and returns a deduplicated, sorted list of LivePrice objects.
 *
 * Parallelism: all scrapers run concurrently with a 25s hard timeout
 * per scraper. A single scraper failure does not block results from others.
 */

import { LivePrice } from "@/types/search";
import { NlpResult }  from "../nlp/hebrewNormalizer";
import { scrapeZap }  from "./zapScraper";
import { scrapeKsp }  from "./kspScraper";
import { scrapeBug }  from "./bugScraper";
import { logger }     from "@/lib/logger";

const SCRAPER_TIMEOUT_MS = 25_000;

export interface FetchResult {
  prices: LivePrice[];
  errors: string[];
}

export async function fetchLivePrices(nlp: NlpResult): Promise<FetchResult> {
  const errors: string[] = [];

  // ── Run all scrapers in parallel, each with a hard timeout ───────────────
  const safeRun = async (
    name:    string,
    fn:      () => Promise<LivePrice[]>
  ): Promise<LivePrice[]> => {
    try {
      const result = await Promise.race([
        fn(),
        new Promise<LivePrice[]>((_, reject) =>
          setTimeout(() => reject(new Error("timeout")), SCRAPER_TIMEOUT_MS)
        ),
      ]);
      return result;
    } catch (err) {
      const msg = `${name}: ${err instanceof Error ? err.message : String(err)}`;
      logger.warn("Scraper failed", { scraper: name, err: msg });
      errors.push(msg);
      return [];
    }
  };

  const [zapPrices, kspPrices, bugPrices] = await Promise.all([
    safeRun("ZAP",  () => scrapeZap(nlp.hebrewQuery, nlp.storageGB)),
    safeRun("KSP",  () => scrapeKsp(nlp.canonicalQuery)),
    safeRun("Bug",  () => scrapeBug(nlp.canonicalQuery)),
  ]);

  const all = [...zapPrices, ...kspPrices, ...bugPrices];

  // ── Deduplicate: keep the cheapest price per store ────────────────────────
  const byStore = new Map<string, LivePrice>();
  for (const price of all) {
    const key      = price.storeName.trim().toLowerCase();
    const existing = byStore.get(key);
    if (!existing || price.price < existing.price) {
      byStore.set(key, price);
    }
  }

  // ── Filter out-of-stock and suspicious prices ──────────────────────────────
  const filtered = Array.from(byStore.values()).filter(
    (p) => p.inStock && p.price > 1 && p.price < 1_000_000
  );

  // Sort cheapest first
  filtered.sort((a, b) => a.price - b.price);

  logger.info("Live price fetch complete", {
    raw:    all.length,
    unique: byStore.size,
    valid:  filtered.length,
    errors: errors.length,
  });

  return { prices: filtered, errors };
}
