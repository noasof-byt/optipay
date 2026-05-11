export const dynamic = 'force-dynamic'

/**
 * GET /api/wallet/cards/[id]/history
 * Returns all SearchHistory records where this gift card was used.
 * Shows: date, product, store, amount deducted.
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

  // Verify card ownership
  const card = await prisma.giftCard.findFirst({
    where:  { id: params.id, userId, deletedAt: null },
    select: { id: true },
  });
  if (!card) return NextResponse.json({ message: "כרטיס לא נמצא" }, { status: 404 });

  const history = await prisma.searchHistory.findMany({
    where:   { giftCardId: params.id, userId },
    orderBy: { createdAt: "desc" },
    select: {
      id:            true,
      productName:   true,
      storeName:     true,
      originalPrice: true,
      finalPrice:    true,
      savingsAmount: true,
      createdAt:     true,
    },
  });

  return NextResponse.json(
    history.map((h) => ({
      id:            h.id,
      productName:   h.productName,
      storeName:     h.storeName,
      originalPrice: h.originalPrice !== null ? Number(h.originalPrice) : null,
      finalPrice:    h.finalPrice    !== null ? Number(h.finalPrice)    : null,
      amountDeducted: h.savingsAmount !== null ? Number(h.savingsAmount) : null,
      date:          h.createdAt,
    }))
  );
}