import "server-only";
/**
 * Club Scraper — Vercel Cron worker
 *
 * Reads every active ClubScrapingConfig from the DB, fetches the club's
 * benefit page using the Cheerio-based scraper strategy, parses benefit
 * rows, and upserts the results into Store + StoreClubBenefit.
 *
 * Called from /api/cron/scrape — never directly.
 */

import { prisma }                        from "@/lib/prisma";
import { logger }                        from "@/lib/logger";
import { runGenericPlaywrightStrategy }  from "@/server/scraper/strategies/genericPlaywrightStrategy";
import type { GenericSelectorConfig }    from "@/server/scraper/strategies/genericPlaywrightStrategy";

// ─────────────────────────────────────────────────────────────────────────────

export async function runClubScraper(): Promise<void> {
  logger.info("[CRON] Club scraper started");

  // Load active scraping configs — oldest-scraped first so every club
  // gets a turn across daily runs even on Vercel's 60 s Hobby limit.
  // Process at most 5 clubs per run to stay well within the budget.
  const configs = await prisma.clubScrapingConfig.findMany({
    where:   { isActive: true },
    include: { club: { select: { id: true, name: true, lastScrapedAt: true } } },
    orderBy: { club: { lastScrapedAt: "asc" } },   // nulls-first = never-scraped priority
    take:    5,
  });

  if (!configs.length) {
    logger.info("[CRON] No active scraping configs found — skipping");
    return;
  }

  let updatedCount = 0;

  for (const config of configs) {
    const clubId   = config.club.id;
    const clubName = config.club.name;

    let selectorConfig: GenericSelectorConfig;
    try {
      selectorConfig = JSON.parse(config.selectorConfig) as GenericSelectorConfig;
    } catch {
      logger.warn("[CRON] Invalid selectorConfig JSON — skipping", { clubName, configId: config.id });
      continue;
    }

    // Record scraping job
    const job = await prisma.scrapingJob.create({
      data: { configId: config.id, status: "RUNNING", startedAt: new Date() },
    });

    try {
      const startMs  = Date.now();
      const benefits = await runGenericPlaywrightStrategy(config.targetUrl, selectorConfig);
      const durationMs = Date.now() - startMs;

      if (!benefits.length) {
        logger.warn("[CRON] Scraper returned 0 benefits", { clubName, url: config.targetUrl });
        await prisma.scrapingJob.update({
          where: { id: job.id },
          data:  { status: "SUCCESS", completedAt: new Date(), durationMs, recordsUpdated: 0 },
        });
        continue;
      }

      // Upsert each benefit row into Store + StoreClubBenefit
      let rowsUpserted = 0;

      for (const benefit of benefits) {
        if (!benefit.discountPercentage) continue; // skip rows with no parseable %

        // Find or create the Store by name
        let store = await prisma.store.findFirst({
          where: { name: { equals: benefit.storeName, mode: "insensitive" } },
        });

        if (!store) {
          store = await prisma.store.create({
            data: {
              name:     benefit.storeName,
              isActive: true,
            },
          });
          logger.info("[CRON] Created new store", { storeName: benefit.storeName });
        }

        // Upsert StoreClubBenefit
        await prisma.storeClubBenefit.upsert({
          where: { storeId_clubId: { storeId: store.id, clubId } },
          update: {
            discountPercentage: benefit.discountPercentage,
            maxDiscountAmount:  benefit.maxDiscountAmount,
            minPurchaseAmount:  benefit.minPurchaseAmount,
            noDoubleDiscount:   benefit.noDoubleDiscount,
            restrictions:       benefit.restrictions,
            validFrom:          benefit.validFrom,
            validUntil:         benefit.validUntil,
            lastVerifiedAt:     new Date(),
            isActive:           true,
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
            lastVerifiedAt:     new Date(),
            isActive:           true,
          },
        });

        logger.info(`[CRON] Updated club: ${clubName}, discount: ${benefit.discountPercentage}%`, {
          storeName: benefit.storeName,
          noDoubleDiscount: benefit.noDoubleDiscount,
        });

        rowsUpserted++;
      }

      // Update Club.lastScrapedAt
      await prisma.club.update({
        where: { id: clubId },
        data:  { lastScrapedAt: new Date() },
      });

      // Mark job success
      await prisma.scrapingJob.update({
        where: { id: job.id },
        data:  {
          status:         "SUCCESS",
          completedAt:    new Date(),
          durationMs,
          recordsUpdated: rowsUpserted,
        },
      });

      updatedCount += rowsUpserted;
      logger.info(`[CRON] Club scrape complete`, { clubName, rowsUpserted, durationMs });

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error("[CRON] Club scrape failed", { clubName, err: msg });

      await prisma.scrapingJob.update({
        where: { id: job.id },
        data:  {
          status:       "FAILED",
          completedAt:  new Date(),
          errorMessage: msg,
        },
      });
    }
  }

  logger.info(`[CRON] Club scraper finished`, { totalRowsUpserted: updatedCount });
}
