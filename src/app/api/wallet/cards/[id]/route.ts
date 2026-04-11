/**
 * PATCH /api/wallet/cards/[id]  — update balance, favorite, etc.
 * DELETE /api/wallet/cards/[id] — archive (soft-delete) or restore
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth, getUserId } from "@/server/auth/middleware";
import { prisma }                 from "@/lib/prisma";

// ── GET ───────────────────────────────────────────────────────────────────────
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const authError = await requireAuth(req);
  if (authError) return authError;
  const userId = getUserId(req);

  const card = await prisma.giftCard.findFirst({
    where:   { id: params.id, userId },
    include: {
      network:  { select: { name: true, logoUrl: true } },
      usageLogs: {
        orderBy: { createdAt: "desc" },
        take:    20,
        select:  { id: true, amountDeducted: true, balanceBefore: true, balanceAfter: true, productName: true, createdAt: true },
      },
    },
  });

  if (!card) return NextResponse.json({ message: "כרטיס לא נמצא" }, { status: 404 });
  return NextResponse.json({ card, type: "gift_card" });
}

const PatchSchema = z.object({
  balance:    z.number().min(0).optional(),
  isFavorite: z.boolean().optional(),
  isArchived: z.boolean().optional(),          // restore from archive
}).refine((d) => Object.keys(d).length > 0, { message: "אין שדות לעדכון" });

async function ownsCard(userId: string, cardId: string) {
  const card = await prisma.giftCard.findFirst({
    where:  { id: cardId, userId },
    select: { id: true },
  });
  return !!card;
}

// ── PATCH ─────────────────────────────────────────────────────────────────────
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const authError = await requireAuth(req);
  if (authError) return authError;
  const userId = getUserId(req);

  if (!await ownsCard(userId, params.id)) {
    return NextResponse.json({ message: "כרטיס לא נמצא" }, { status: 404 });
  }

  let body: z.infer<typeof PatchSchema>;
  try {
    body = PatchSchema.parse(await req.json());
  } catch (err: any) {
    return NextResponse.json(
      { message: err.errors?.[0]?.message ?? "קלט לא תקין" },
      { status: 400 }
    );
  }

  const updated = await prisma.giftCard.update({
    where: { id: params.id },
    data:  {
      ...(body.balance    !== undefined && { balance:    body.balance }),
      ...(body.isFavorite !== undefined && { isFavorite: body.isFavorite }),
      ...(body.isArchived !== undefined && {
        isArchived: body.isArchived,
        archivedAt: body.isArchived ? new Date() : null,
      }),
    },
    select: { id: true, balance: true, isFavorite: true, isArchived: true },
  });

  return NextResponse.json(updated);
}

// ── DELETE (archive) ──────────────────────────────────────────────────────────
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const authError = await requireAuth(req);
  if (authError) return authError;
  const userId = getUserId(req);

  if (!await ownsCard(userId, params.id)) {
    return NextResponse.json({ message: "כרטיס לא נמצא" }, { status: 404 });
  }

  await prisma.giftCard.update({
    where: { id: params.id },
    data:  { isArchived: true, archivedAt: new Date() },
  });

  return NextResponse.json({ message: "הכרטיס הועבר לארכיון" });
}
