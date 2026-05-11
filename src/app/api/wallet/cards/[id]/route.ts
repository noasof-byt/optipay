export const dynamic = 'force-dynamic'

/**
 * GET    /api/wallet/cards/[id]  — card detail + recent usage logs
 * PATCH  /api/wallet/cards/[id]  — update balance / favorite / expiryDate / isArchived
 * DELETE /api/wallet/cards/[id]  — soft-delete (set deletedAt)
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth, getUserId } from "@/server/auth/middleware";
import { prisma }                 from "@/lib/prisma";
import { decrypt }                from "@/lib/encryption";

// ── Ownership helper ──────────────────────────────────────────────────────────
async function ownsCard(userId: string, cardId: string) {
  const card = await prisma.giftCard.findFirst({
    where:  { id: cardId, userId, deletedAt: null },
    select: { id: true },
  });
  return !!card;
}

// ── GET ───────────────────────────────────────────────────────────────────────
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const authError = await requireAuth(req);
  if (authError) return authError;
  const userId = getUserId(req);

  const card = await prisma.giftCard.findFirst({
    where:   { id: params.id, userId, deletedAt: null },
    include: {
      network:  { select: { name: true, logoUrl: true } },
      usageLogs: {
        orderBy: { createdAt: "desc" },
        take:    20,
        select:  {
          id: true, amountDeducted: true, balanceBefore: true,
          balanceAfter: true, productName: true, createdAt: true,
        },
      },
    },
  });

  if (!card) return NextResponse.json({ message: "כרטיס לא נמצא" }, { status: 404 });

  return NextResponse.json({
    card: {
      ...card,
      cardNumber: card.cardNumberEncrypted ? decrypt(card.cardNumberEncrypted) : null,
      cardNumberEncrypted: undefined,
    },
    type: "gift_card",
  });
}

// ── PATCH ─────────────────────────────────────────────────────────────────────
const PatchSchema = z.object({
  balance:    z.number().min(0).optional(),
  isFavorite: z.boolean().optional(),
  expiryDate: z.string().refine((d) => new Date(d) > new Date(), {
    message: "תאריך התפוגה חייב להיות בעתיד",
  }).optional(),
  isArchived: z.boolean().optional(),
}).refine((d) => Object.keys(d).length > 0, { message: "אין שדות לעדכון" });

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

  // Auto-archive when balance reaches 0
  const newBalance     = body.balance;
  const autoArchived   = newBalance === 0;
  const shouldArchive  = autoArchived || body.isArchived === true;
  const shouldRestore  = body.isArchived === false;

  const updated = await prisma.giftCard.update({
    where: { id: params.id },
    data: {
      ...(newBalance    !== undefined && { balance: newBalance }),
      ...(body.isFavorite !== undefined && { isFavorite: body.isFavorite }),
      ...(body.expiryDate !== undefined && { expiryDate: new Date(body.expiryDate) }),
      ...(shouldArchive && { isArchived: true,  archivedAt: new Date() }),
      ...(shouldRestore && { isArchived: false, archivedAt: null }),
    },
    select: { id: true, balance: true, isFavorite: true, isArchived: true, expiryDate: true },
  });

  return NextResponse.json({
    ...updated,
    ...(autoArchived && { autoArchived: true }),
  });
}

// ── DELETE (soft-delete) ──────────────────────────────────────────────────────
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
    data:  { deletedAt: new Date() },
  });

  return NextResponse.json({ message: "הכרטיס נמחק" });
}