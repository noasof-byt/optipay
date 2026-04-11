/**
 * Scraper Orchestrator
 *
 * Loads all active ClubScrapingConfigs from the DB, dispatches the correct
 * strategy for each (Playwright or Cheerio), persists raw results, then
 * calls applyScrapingResults to write the structured data.
 *
 * Each club is processed sequentially to avoid hammering servers.
 * A per-club failure is caught and logged without aborting the rest.
 */

import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { parseBenefits } from "./parsers/benefitParser";
import { runGenericPlaywrightStrategy } from "./strategies/genericPlaywrightStrategy";
import { runGenericCheerioStrategy }    from "./strategies/genericCheerioStrategy";
import { applyScrapingResults }         from "./applyScrapingResult";
import { closeBrowser }                 from "./engine/playwrightEngine";
type ScrapingJobStatus = "PENDING" | "RUNNING" | "SUCCESS" | "FAILED" | "SKIPPED";

// ─────────────────────────────────────────────────────────────────────────────

export async function runAllScrapers(): Promise<void> {
  const configs = await prisma.clubScrapingConfig.findMany({
    where:   { isActive: true },
    include: { club: { select: { id: true, name: true } } },
  });

  if (!configs.length) {
    logger.warn("No active scraping configs found — nothing to do");
    return;
  }

  logger.info(`Starting scrape run for ${configs.length} clubs`);
  let totalBenefits = 0;

  for (const config of configs) {
    const job = await createJob(config.id);
    const startedAt = Date.now();

    try {
      // ── Mark job as RUNNING ──────────────────────────────────────────────
      await updateJobStatus(job.id, "RUNNING", { startedAt: new Date() });

      logger.info(`Scraping club: ${config.club.name}`, {
        configId:  config.id,
        strategy:  config.scrapeStrategy,
        targetUrl: config.targetUrl,
      });

      // ── Dispatch to the right engine ────────────────────────────────────
      const selectorConfig = (config.selectorConfig as unknown) as Record<string, string>;
      let benefits;

      if (config.scrapeStrategy === "cheerio") {
        benefits = await runGenericCheerioStrategy(config.targetUrl, {
          rowSelector:     selectorConfig.rowSelector     ?? "tr",
          storeSelector:   selectorConfig.storeName       ?? "td:first-child",
          benefitSelector: selectorConfig.discountText    ?? "td:nth-child(2)",
          nextPageSelector: selectorConfig.paginationNext ?? undefined,
        });
      } else {
        // Default: playwright
        benefits = await runGenericPlaywrightStrategy(config.targetUrl, {
          storeName:       selectorConfig.storeName,
          discountText:    selectorConfig.discountText,
          restrictionText: selectorConfig.restrictionText,
          paginationNext:  selectorConfig.paginationNext,
        });
      }

      // ── Persist raw parsed output ────────────────────────────────────────
      await prisma.scrapingResult.create({
        data: {
          jobId:      job.id,
          targetUrl:  config.targetUrl,
          parsedData: JSON.stringify(benefits),
          isApplied:  false,
        },
      });

      // ── Write to production tables ───────────────────────────────────────
      const applyResult = await applyScrapingResults(benefits, {
        clubId: config.club.id,
        jobId:  job.id,
      });

      const durationMs = Date.now() - startedAt;
      totalBenefits += applyResult.benefitsUpserted;

      logger.info(`Club scrape complete: ${config.club.name}`, {
        ...applyResult,
        durationMs,
      });

      await updateJobStatus(job.id, "SUCCESS", {
        completedAt:    new Date(),
        durationMs,
        recordsUpdated: applyResult.benefitsUpserted,
      });

    } catch (err) {
      const durationMs = Date.now() - startedAt;
      const errorMessage = err instanceof Error ? err.message : String(err);

      logger.error(`Club scrape FAILED: ${config.club.name}`, {
        configId: config.id,
        error:    errorMessage,
        durationMs,
      });

      await updateJobStatus(job.id, "FAILED", {
        completedAt:  new Date(),
        durationMs,
        errorMessage,
      });

      // Persist a minimal error result for debugging
      await prisma.scrapingResult.create({
        data: {
          jobId:      job.id,
          targetUrl:  config.targetUrl,
          parsedData: JSON.stringify({ error: errorMessage }),
          isApplied:  false,
        },
      }).catch(() => {}); // don't crash on result-write failure
    }

    // Polite delay between clubs to avoid rate-limiting
    await sleep(2_000 + Math.random() * 2_000);
  }

  // ── Shut down browser after all clubs are done ───────────────────────────
  await closeBrowser();

  logger.info("Full scrape run complete", { totalBenefits, clubs: configs.length });
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

async function createJob(configId: string) {
  return prisma.scrapingJob.create({
    data: { configId, status: "PENDING" },
  });
}

async function updateJobStatus(
  jobId:  string,
  status: ScrapingJobStatus,
  extra:  {
    startedAt?:     Date;
    completedAt?:   Date;
    durationMs?:    number;
    recordsUpdated?: number;
    errorMessage?:  string;
  } = {}
) {
  return prisma.scrapingJob.update({
    where: { id: jobId },
    data:  { status, ...extra },
  });
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
