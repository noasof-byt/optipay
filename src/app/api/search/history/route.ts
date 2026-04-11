/**
 * GET  /api/search/history   — last 10 searches for the logged-in user
 * DELETE /api/search/history?id=<id>  — remove a single history entry
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAuth, getUserId }    from "@/server/auth/middleware";
import { prisma }                    from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const authError = await requireAuth(req);
  if (authError) return authError;
  const userId = getUserId(req);

  const history = await prisma.searchHistory.findMany({
    where:   { userId },
    orderBy: { createdAt: "desc" },
    take:    10,
    select:  { id: true, query: true, createdAt: true },
  });

  return NextResponse.json(history);
}

export async function DELETE(req: NextRequest) {
  const authError = await requireAuth(req);
  if (authError) return authError;
  const userId = getUserId(req);

  const id = req.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ message: "נדרש מזהה" }, { status: 400 });
  }

  // Make sure this entry belongs to the requesting user
  await prisma.searchHistory.deleteMany({ where: { id, userId } });

  return NextResponse.json({ ok: true });
}
