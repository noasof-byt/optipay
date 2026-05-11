export const dynamic = 'force-dynamic'

/**
 * POST /api/wallet/use-route
 *
 * Records that the user used a buying route (applied a benefit).
 * - If giftCardId:   subtract amountDeducted from card balance; archive if balance reaches 0.
 * - If membershipId: update membership lastUsedAt to now.
 * - Always creates a SearchHistory record for ROI tracking.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth, getUserId } from "@/server/auth/middleware";
import { prisma }                 from "@/lib/prisma";

const UseRouteSchema = z.object({
  routeId:        z.string().min(1),
  giftCardId:     z.string().uuid().optional(),
  membershipId:   z.string().uuid().optional(),
  amountDeducted: z.number().min(0),
  originalPrice:  z.number().min(0),
  storeName:      z.string().max(200),
  productName:    z.string().max(500),
});

export async function POST(req: NextRequest) {
  const authError = await requireAuth(req);
  if (authError) return authError;
  const userId = getUserId(req);

  let body: z.infer<typeof UseRouteSchema>;
  try {
    body = UseRouteSchema.parse(await req.json());
  } catch (err: any) {
    const message = err.errors?.[0]?.message ?? "קלט לא תקין";
    return NextResponse.json({ message }, { status: 400 });
  }

  const finalPrice   = body.originalPrice - body.amountDeducted;
  const savingsAmount = body.amountDeducted;

  let autoArchived   = false;
  let newBalance: number | null = null;
  let benefitUsed    = "";

  // ── Gift card: deduct balance ─────────────────────────────────────────────
  if (body.giftCardId) {
    const card = await prisma.giftCard.findFirst({
      where:  { id: body.giftCardId, userId, deletedAt: null },
      select: { id: true, balance: true, network: { select: { name: true } } },
    });
    if (!card) {
      return NextResponse.json({ message: "כרטיס מתנה לא נמצא" }, { status: 404 });
    }

    newBalance   = Math.max(0, Number(card.balance) - body.amountDeducted);
    autoArchived = newBalance === 0;
    benefitUsed  = card.network?.name ?? "כרטיס מתנה";

    await prisma.giftCard.update({
      where: { id: body.giftCardId },
      data: {
        balance:    newBalance,
        usageCount: { increment: 1 },
        lastUsedAt: new Date(),
        ...(autoArchived && { isArchived: true, archivedAt: new Date() }),
      },
    });
  }

  // ── Membership: update lastUsedAt ─────────────────────────────────────────
  if (body.membershipId) {
    const membership = await prisma.userClubMembership.findFirst({
      where:  { id: body.membershipId, userId, isActive: true },
      select: { id: true, club: { select: { name: true } } },
    });
    if (!membership) {
      return NextResponse.json({ message: "חברות לא נמצאה" }, { status: 404 });
    }

    benefitUsed = membership.club.name;

    await prisma.userClubMembership.update({
      where: { id: body.membershipId },
      data:  { lastUsedAt: new Date() },
    });
  }

  // ── Create SearchHistory record ───────────────────────────────────────────
  await prisma.searchHistory.create({
    data: {
      userId,
      query:        body.productName,
      resultCount:  1,
      productName:  body.productName,
      storeName:    body.storeName,
      originalPrice: body.originalPrice,
      finalPrice,
      savingsAmount,
      benefitUsed:  benefitUsed || null,
      giftCardId:   body.giftCardId  ?? null,
      membershipId: body.membershipId ?? null,
    },
  });

  return NextResponse.json({
    success:      true,
    finalPrice,
    savingsAmount,
    ...(newBalance !== null && { newBalance }),
    ...(autoArchived       && { autoArchived: true }),
  });
}