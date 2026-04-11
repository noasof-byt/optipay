/**
 * GET /api/search?q=QUERY
 *
 * Real-time product search endpoint.
 * Authenticated — requires Bearer token.
 *
 * Response: SearchResponse (types/search.ts)
 *
 * The endpoint streams the response as soon as it's ready.
 * Typical latency: 5–15s (dominated by Playwright scraping).
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, getUserId }    from "@/server/auth/middleware";
import { runSearch }                 from "@/server/search/searchOrchestrator";

export async function GET(req: NextRequest) {
  const authError = await requireAuth(req);
  if (authError) return authError;

  const query = req.nextUrl.searchParams.get("q")?.trim();
  if (!query || query.length < 2) {
    return NextResponse.json(
      { message: "נא להזין מונח חיפוש (לפחות 2 תווים)" },
      { status: 400 }
    );
  }

  if (query.length > 200) {
    return NextResponse.json(
      { message: "מונח החיפוש ארוך מדי" },
      { status: 400 }
    );
  }

  try {
    const userId  = getUserId(req);
    const result  = await runSearch(query, userId);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[search] unhandled error", err);
    return NextResponse.json(
      { message: "שגיאה בשרת. נסה שוב." },
      { status: 500 }
    );
  }
}

// Disable body size limit — not needed for GET, but guard just in case
export const maxDuration = 60; // Vercel: allow up to 60s for scraping
