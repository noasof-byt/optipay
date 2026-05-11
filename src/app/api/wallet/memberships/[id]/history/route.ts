/**
 * GET /api/wallet/memberships/[id]/history
 * Returns all SearchHistory records where this membership was used.
 * Shows: date, product, store, discount applied.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAuth, getUserId } from "@/server/auth/middleware";
import { prisma }                 from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const authError = await requireAuth(req);
  if (authError) return authError;
  const userId = getUserId(req);

  // Verify membership ownership
  const membership = await prisma.userClubMembership.findFirst({
    where:  { id: params.id, userId },
    select: { id: true },
  });
  if (!membership) return NextResponse.json({ message: "חברות לא נמצאה" }, { status: 404 });

  const history = await prisma.searchHistory.findMany({
    where:   { membershipId: params.id, userId },
    orderBy: { createdAt: "desc" },
    select: {
      id:            true,
      productName:   true,
      storeName:     true,
      originalPrice: true,
      finalPrice:    true,
      savingsAmount: true,
      benefitUsed:   true,
      createdAt:     true,
    },
  });

  return NextResponse.json(
    history.map((h) => ({
      id:             h.id,
      productName:    h.productName,
      storeName:      h.storeName,
      originalPrice:  h.originalPrice  !== null ? Number(h.originalPrice)  : null,
      finalPrice:     h.finalPrice     !== null ? Number(h.finalPrice)     : null,
      discountApplied: h.savingsAmount !== null ? Number(h.savingsAmount)  : null,
      benefitUsed:    h.benefitUsed,
      date:           h.createdAt,
    }))
  );
}
