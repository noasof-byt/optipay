/**
 * Store Resolver
 *
 * Maps scraped store names (free-text strings like "KSP", "bug.co.il")
 * to the canonical `Store.id` in the database using fuzzy name matching.
 *
 * This is critical: the matchmaker needs the storeId to look up
 * `StoreClubBenefit` and `StoreNetwork` rows.
 *
 * Strategy:
 *   1. Exact name match (case-insensitive)
 *   2. Partial / contains match
 *   3. If still no match — upsert as a new store (will be enriched by the
 *      next CRON scrape) and return its new ID.
 */

import { prisma } from "@/lib/prisma";
import { logger }  from "@/lib/logger";

// Module-level cache to avoid repeated DB lookups within a single request
const cache = new Map<string, string>(); // storeName → storeId

export async function resolveStoreId(scraperName: string): Promise<string | null> {
  const key = scraperName.trim().toLowerCase();
  if (cache.has(key)) return cache.get(key)!;

  // ── 1. Exact match (SQL Server collation is case-insensitive by default) ────
  let store = await prisma.store.findFirst({
    where:  { name: { equals: scraperName.trim() } },
    select: { id: true },
  });

  // ── 2. Contains match ──────────────────────────────────────────────────────
  if (!store) {
    store = await prisma.store.findFirst({
      where:  { name: { contains: scraperName.trim() } },
      select: { id: true },
    });
  }

  // ── 3. Reverse contains: scraperName contains the DB store name ───────────
  if (!store) {
    const allStores = await prisma.store.findMany({
      where:  { isActive: true },
      select: { id: true, name: true },
      take:   200,
    });
    for (const s of allStores) {
      if (key.includes(s.name.toLowerCase())) {
        store = { id: s.id };
        break;
      }
    }
  }

  // ── 4. Auto-create unknown store ───────────────────────────────────────────
  if (!store) {
    logger.info("StoreResolver: auto-creating store", { scraperName });
    store = await prisma.store.create({
      data:   { name: scraperName.trim(), isActive: true },
      select: { id: true },
    });
  }

  cache.set(key, store.id);
  return store.id;
}

/** Resolve a list of scraper store names → { scraperName, storeId } map. */
export async function resolveStoreIds(
  names: string[]
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  await Promise.all(
    [...new Set(names)].map(async (name) => {
      const id = await resolveStoreId(name);
      if (id) result.set(name, id);
    })
  );
  return result;
}
