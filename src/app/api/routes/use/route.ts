export const dynamic = 'force-dynamic'

/**
 * POST /api/routes/use
 *
 * "I used this route" — the critical post-purchase action.
 *
 * What this does atomically:
 *   1. Deducts the used gift card balance(s)
 *   2. Writes an immutable CardUsageLog per card
 *   3. Updates UserClubMembership.lastUsedAt
 *   4. Creates a SavingsRecord for the dashboard
 *
 * Body: {
 *   route: BuyingRoute;        // the route the user confirmed
 *   productName: string;
 * }
 */

import { NextRequest, NextResponse }   from "next/server";
import { requireAuth, getUserId }      from "@/server/auth/middleware";
import { prisma }                      from "@/lib/prisma";
import { BuyingRoute }                 from "@/types/search";
import { z }                           from "zod";

const BodySchema = z.object({
  route:       z.object({
    id:            z.string(),
    storeName:     z.string(),
    storeId:       z.string().optional(),
    originalPrice: z.number().positive(),
    finalPrice:    z.number().min(0),
    savedAmount:   z.number().min(0),
    discounts:     z.array(z.object({
      type:           z.enum(["club", "gift_card"]),
      giftCardId:     z.string().optional(),
      clubId:         z.string().optional(),
      amountDeducted: z.number(),
    })),
    storeUrl:      z.string().url(),
  }),
  productName: z.string().min(1).max(300),
});

export async function POST(req: NextRequest) {
  const authError = await requireAuth(req);
  if (authError) return authError;

  const userId = getUserId(req);
  let body: z.infer<typeof BodySchema>;

  try {
    body = BodySchema.parse(await req.json());
  } catch (err) {
    return NextResponse.json({ message: "גוף הבקשה אינו תקין" }, { status: 400 });
  }

  const { route, productName } = body;

  // Run everything in a transaction so partial updates cannot occur
  try {
    await prisma.$transaction(async (tx) => {
      for (const discount of route.discounts) {
        // ── Gift card deduction ────────────────────────────────────────────
        if (discount.type === "gift_card" && discount.giftCardId) {
          const card = await tx.giftCard.findFirst({
            where: { id: discount.giftCardId, userId },
            select: { id: true, balance: true },
          });

          if (!card) throw new Error(`כרטיס ${discount.giftCardId} לא נמצא`);

          const balanceBefore = Number(card.balance);
          const balanceAfter  = Math.max(0, balanceBefore - discount.amountDeducted);

          await tx.giftCard.update({
            where: { id: card.id },
            data:  {
              balance:    balanceAfter,
              usageCount: { increment: 1 },
              lastUsedAt: new Date(),
            },
          });

          await tx.cardUsageLog.create({
            data: {
              giftCardId:     card.id,
              userId,
              amountDeducted: discount.amountDeducted,
              balanceBefore,
              balanceAfter,
              productName,
              storeId:        route.storeId,
              routeSnapshot:  JSON.stringify(route),
            },
          });
        }

        // ── Club membership last-used update ───────────────────────────────
        if (discount.type === "club" && discount.clubId) {
          await tx.userClubMembership.updateMany({
            where: { userId, clubId: discount.clubId },
            data:  { lastUsedAt: new Date() },
          });
        }
      }

      // ── Savings record ─────────────────────────────────────────────────
      await tx.savingsRecord.create({
        data: {
          userId,
          storeId:       route.storeId,
          productName,
          originalPrice: route.originalPrice,
          finalPrice:    route.finalPrice,
          savedAmount:   route.savedAmount,
          routeSnapshot: JSON.stringify(route),
        },
      });
    });

    return NextResponse.json({ message: "עודכן בהצלחה 🎉" });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "שגיאה לא ידועה";
    console.error("[routes/use] transaction failed", err);
    return NextResponse.json({ message: msg }, { status: 500 });
  }
}