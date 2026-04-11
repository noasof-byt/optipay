/**
 * Apply Scraping Results to the Database
 *
 * Takes parsed benefits from the scraper and upserts them into:
 *   - `stores` table (create store if first seen)
 *   - `store_club_benefits` table (upsert discount + rules)
 *
 * This is designed to be idempotent: running it twice with the same
 * data produces the same database state.
 */

import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { ParsedBenefit } from "./parsers/benefitParser";

export interface ApplyOptions {
  clubId: string;
  jobId:  string;
}

export interface ApplyResult {
  storesUpserted:   number;
  benefitsUpserted: number;
  skipped:          number;
}

export async function applyScrapingResults(
  benefits: ParsedBenefit[],
  { clubId, jobId }: ApplyOptions
): Promise<ApplyResult> {
  let storesUpserted   = 0;
  let benefitsUpserted = 0;
  let skipped          = 0;

  for (const benefit of benefits) {
    // Skip entries with no actionable data
    if (!benefit.storeName || benefit.discountPercentage === null) {
      skipped++;
      continue;
    }

    try {
      // ── 1. Upsert the store ──────────────────────────────────────────────
      const store = await prisma.store.upsert({
        where:  { name: benefit.storeName },
        create: {
          name:     benefit.storeName,
          isOnline: false,
          isActive: true,
        },
        update: {
          isActive:  true,
          updatedAt: new Date(),
        },
      });

      if (store) storesUpserted++;

      // ── 2. Upsert StoreClubBenefit ──────────────────────────────────────
      await prisma.storeClubBenefit.upsert({
        where: {
          storeId_clubId: { storeId: store.id, clubId },
        },
        create: {
          storeId:            store.id,
          clubId,
          discountPercentage: benefit.discountPercentage,
          maxDiscountAmount:  benefit.maxDiscountAmount,
          minPurchaseAmount:  benefit.minPurchaseAmount,
          noDoubleDiscount:   benefit.noDoubleDiscount,
          restrictions:       benefit.restrictions,
          validFrom:          benefit.validFrom,
          validUntil:         benefit.validUntil,
          isActive:           true,
          lastVerifiedAt:     new Date(),
        },
        update: {
          discountPercentage: benefit.discountPercentage,
          maxDiscountAmount:  benefit.maxDiscountAmount,
          minPurchaseAmount:  benefit.minPurchaseAmount,
          noDoubleDiscount:   benefit.noDoubleDiscount,
          restrictions:       benefit.restrictions,
          validFrom:          benefit.validFrom,
          validUntil:         benefit.validUntil,
          isActive:           true,
          lastVerifiedAt:     new Date(),
          updatedAt:          new Date(),
        },
      });

      benefitsUpserted++;
    } catch (err) {
      logger.error("Failed to upsert benefit", {
        storeName: benefit.storeName,
        clubId,
        err: String(err),
      });
      skipped++;
    }
  }

  // ── 3. Mark job results as applied ──────────────────────────────────────
  await prisma.scrapingResult.updateMany({
    where:  { jobId, isApplied: false },
    data:   { isApplied: true },
  });

  // ── 4. Deactivate benefits NOT seen in this scrape ───────────────────────
  // Any store-club benefit that wasn't re-verified in this run is marked
  // inactive — it may have been removed from the club's website.
  const verifiedStoreNames = benefits
    .filter((b) => b.storeName && b.discountPercentage !== null)
    .map((b) => b.storeName);

  if (verifiedStoreNames.length > 0) {
    const verifiedStores = await prisma.store.findMany({
      where: { name: { in: verifiedStoreNames } },
      select: { id: true },
    });
    const verifiedIds = verifiedStores.map((s) => s.id);

    await prisma.storeClubBenefit.updateMany({
      where: {
        clubId,
        storeId: { notIn: verifiedIds },
        isActive: true,
      },
      data: { isActive: false, updatedAt: new Date() },
    });
  }

  return { storesUpserted, benefitsUpserted, skipped };
}
