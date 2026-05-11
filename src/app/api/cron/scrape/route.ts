export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from "next/server";
import { runClubScraper }   from "@/lib/cron/clubScraper";
import { runExpiryChecker } from "@/lib/cron/expiryChecker";

// Vercel Hobby plan cap is 60 s — process a limited batch of clubs per run
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await runClubScraper();
    await runExpiryChecker();
    return NextResponse.json({ success: true, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error("[CRON] Failed:", error);
    return NextResponse.json({ error: "Cron failed" }, { status: 500 });
  }
}