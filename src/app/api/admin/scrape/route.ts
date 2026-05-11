export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/scrape
 *
 * Manually triggers the full club scraper.
 * Restricted to users with ADMIN role.
 * Runs in the background — returns immediately with a job-started response.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/server/auth/middleware";
import { runAllScrapers } from "@/server/scraper/runScraper";
import { logger } from "@/lib/logger";

export async function POST(req: NextRequest) {
  const authError = await requireAdmin(req);
  if (authError) return authError;

  // Fire and forget — don't await so the response returns immediately
  runAllScrapers().catch((err) =>
    logger.error("Manual scrape trigger failed", { err: String(err) })
  );

  return NextResponse.json(
    { message: "הפעלת הסריקה התחילה ברקע" },
    { status: 202 }
  );
}