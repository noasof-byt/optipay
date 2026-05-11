/**
 * GET /api/wallet/cards/archived — list archived (but not deleted) gift cards
 * User can restore them from the archive.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAuth, getUserId } from "@/server/auth/middleware";
import { prisma }                 from "@/lib/prisma";
import { decrypt }                from "@/lib/encryption";

export async function GET(req: NextRequest) {
  const authError = await requireAuth(req);
  if (authError) return authError;
  const userId = getUserId(req);

  const cards = await prisma.giftCard.findMany({
    where:   { userId, isArchived: true, deletedAt: null },
    include: { network: { select: { id: true, name: true, logoUrl: true } } },
    orderBy: { archivedAt: "desc" },
  });

  const safe = cards.map((c) => ({
    id:                c.id,
    networkId:         c.networkId,
    networkName:       c.network?.name ?? null,
    networkLogo:       c.network?.logoUrl ?? null,
    storeSpecificName: c.storeSpecificName,
    cardNumberHint:    c.cardNumberHint,
    cardNumber:        c.cardNumberEncrypted ? decrypt(c.cardNumberEncrypted) : null,
    expiryDate:        c.expiryDate,
    balance:           Number(c.balance),
    currency:          c.currency,
    isFavorite:        c.isFavorite,
    isArchived:        c.isArchived,
    archivedAt:        c.archivedAt,
    usageCount:        c.usageCount,
    lastUsedAt:        c.lastUsedAt,
    createdAt:         c.createdAt,
  }));

  return NextResponse.json(safe);
}
