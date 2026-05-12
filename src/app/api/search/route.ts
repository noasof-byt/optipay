export const dynamic = 'force-dynamic'

/**
 * GET  /api/search?q=QUERY  — legacy orchestrator (NLP + Playwright scrapers)
 * POST /api/search           — Phase 4 engine (Gemini normalizer + direct-HTTP scrapers)
 *
 * Both require authentication.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, getUserId }    from "@/server/auth/middleware";
import { runSearch }                 from "@/server/search/searchOrchestrator";
import { normalizeQuery }            from "@/lib/search/normalizer";
import { scrapeBug }                 from "@/lib/search/scrapers/bug";
import { searchWithSerpApi }         from "@/lib/search/scrapers/serpApiSearch";
import { matchmaker, RawResult }     from "@/lib/search/matchmaker";
import { loadUserWallet }            from "@/server/search/matchmaker/walletLoader";
import { prisma }                    from "@/lib/prisma";

// ── GET (legacy) ─────────────────────────────────────────────────────────────
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
    const userId = getUserId(req);
    const result = await runSearch(query, userId);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[search] unhandled error", err);
    return NextResponse.json(
      { message: "שגיאה בשרת. נסה שוב." },
      { status: 500 }
    );
  }
}

// ── POST (Phase 4 engine) ─────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const authError = await requireAuth(req);
  if (authError) return authError;
  const userId = getUserId(req);

  let body: { query?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "גוף הבקשה אינו JSON תקין" }, { status: 400 });
  }

  const query = typeof body?.query === "string" ? body.query.trim() : "";
  if (!query || query.length < 2) {
    return NextResponse.json(
      { message: "נא להזין מונח חיפוש (לפחות 2 תווים)" },
      { status: 400 }
    );
  }
  if (query.length > 200) {
    return NextResponse.json({ message: "מונח החיפוש ארוך מדי" }, { status: 400 });
  }

  console.log("[SEARCH POST] query:", query, "userId:", userId);

  try {
    // ── Step 1: Normalize query with Gemini ────────────────────────────────
    const normalized = await normalizeQuery(query);
    console.log("[SEARCH] Normalized query:", normalized);

    // ── Step 2: Fetch from Bug scraper + SerpApi concurrently ─────────────
    console.log("[SEARCH] Starting Bug scraper + SerpApi...");
    const [bugResults, serpResults] = await Promise.allSettled([
      scrapeBug(query),
      searchWithSerpApi(query),
    ]);

    const bugData  = bugResults.status  === "fulfilled" ? bugResults.value  : [];
    const serpData = serpResults.status === "fulfilled" ? serpResults.value : [];

    console.log("[SEARCH] Bug:",     bugData.length,  "results");
    console.log("[SEARCH] SerpApi:", serpData.length, "results");

    const allResults: RawResult[] = [...bugData, ...serpData];

    // ── Step 3: Run matchmaker ─────────────────────────────────────────────
    const wallet = await loadUserWallet(userId);
    const routes = await matchmaker(allResults, wallet);

    // ── Step 4: Save to SearchHistory (fire-and-forget) ────────────────────
    prisma.searchHistory.create({
      data: {
        userId,
        query,
        resultCount: routes.length,
        productName: normalized.canonical,
      },
    }).catch(() => {});

    // ── Step 5: Return ──────────────────────────────────────────────────────
    return NextResponse.json({
      query,
      normalized,
      routes,
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[SEARCH POST] unhandled error:", err);
    return NextResponse.json({ message: "שגיאה בשרת. נסה שוב." }, { status: 500 });
  }
}

export const maxDuration = 60; // Vercel: allow up to 60s for scraping