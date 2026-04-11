/**
 * CRON Scheduler
 *
 * Registers all recurring background jobs using node-cron.
 * Designed to be imported once from `instrumentation.ts` on server startup.
 *
 * Schedule syntax (node-cron):
 *   ┌──── second (0-59)   [optional]
 *   │ ┌──── minute (0-59)
 *   │ │ ┌──── hour (0-23)
 *   │ │ │ ┌──── day of month (1-31)
 *   │ │ │ │ ┌──── month (1-12)
 *   │ │ │ │ │ ┌──── day of week (0-7, 0 and 7 = Sunday)
 *   │ │ │ │ │ │
 *   * * * * * *
 */

import cron from "node-cron";
import { logger } from "@/lib/logger";
import { runAllScrapers }        from "./jobs/clubScrapeJob";
import { runExpiredCardArchiver } from "./jobs/expiredCardArchiver";
import { runExpiryNotifier }     from "./jobs/expiryNotifier";
import { runUnusedMembershipAlert } from "./jobs/unusedMembershipAlert";

let initialized = false;

export function startScheduler(): void {
  if (initialized) {
    logger.warn("Scheduler already initialized — skipping");
    return;
  }
  initialized = true;

  // ── 1. Club benefit scraper — every day at 03:00 AM Israel time ───────────
  // Running at 03:00 minimises impact on live sites (low traffic).
  cron.schedule(
    "0 3 * * *",
    async () => {
      logger.info("CRON: Starting club benefit scraper");
      try {
        await runAllScrapers();
      } catch (err) {
        logger.error("CRON: Club scraper failed at top level", { err: String(err) });
      }
    },
    { timezone: "Asia/Jerusalem" }
  );

  // ── 2. Expired card archiver — every day at 00:05 AM ─────────────────────
  // Moves gift cards past their expiry date to isArchived=true.
  cron.schedule(
    "5 0 * * *",
    async () => {
      logger.info("CRON: Running expired card archiver");
      try {
        await runExpiredCardArchiver();
      } catch (err) {
        logger.error("CRON: Expired card archiver failed", { err: String(err) });
      }
    },
    { timezone: "Asia/Jerusalem" }
  );

  // ── 3. Expiry notifications — every day at 09:00 AM ──────────────────────
  // Sends push notifications for cards expiring in ≤30 days.
  cron.schedule(
    "0 9 * * *",
    async () => {
      logger.info("CRON: Running expiry notifier");
      try {
        await runExpiryNotifier();
      } catch (err) {
        logger.error("CRON: Expiry notifier failed", { err: String(err) });
      }
    },
    { timezone: "Asia/Jerusalem" }
  );

  // ── 4. Unused paid membership alert — every Monday at 10:00 AM ───────────
  // Alerts users who have paid memberships unused for >6 months.
  cron.schedule(
    "0 10 * * 1",
    async () => {
      logger.info("CRON: Running unused membership alert");
      try {
        await runUnusedMembershipAlert();
      } catch (err) {
        logger.error("CRON: Unused membership alert failed", { err: String(err) });
      }
    },
    { timezone: "Asia/Jerusalem" }
  );

  logger.info("CRON scheduler started — 4 jobs registered");
}
