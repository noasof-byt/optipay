/**
 * Club Scrape Job
 *
 * Thin wrapper exported from the scheduler to allow manual triggering
 * (e.g. from the Admin API endpoint POST /api/admin/scrape/run).
 */

import { runAllScrapers } from "../../scraper/runScraper";

export { runAllScrapers };
