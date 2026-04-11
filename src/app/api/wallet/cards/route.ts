/**
 * GET  /api/wallet/cards  — list user's gift cards
 * POST /api/wallet/cards  — add a new gift card
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth, getUserId } from "@/server/auth/middleware";
import { prisma }                 from "@/lib/prisma";
import { encrypt, lastNChars }   from "@/lib/encryption";

// ── Validation ────────────────────────────────────────────────────────────────
const AddCardSchema = z.object({
  cardNumber:   z.string().min(4).max(30).regex(/^\d+$/, "מספר כרטיס חייב להכיל ספרות בלבד"),
  networkId:    z.string().uuid().optional(),
  storeSpecificName: z.string().max(80).optional(),
  expiryDate:   z.string().refine((d) => new Date(d) > new Date(), {
    message: "תאריך התפוגה חייב להיות בעתיד",
  }),
  balance:      z.number().positive("היתרה חייבת להיות חיובית"),
  isFavorite:   z.boolean().optional(),
});

// ── GET ───────────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const authError = await requireAuth(req);
  if (authError) return authError;
  const userId = getUserId(req);

  const { searchParams } = req.nextUrl;
  const archived = searchParams.get("archived") === "true";

  const cards = await prisma.giftCard.findMany({
    where: { userId, isArchived: archived },
    include: { network: { select: { id: true, name: true, logoUrl: true } } },
    orderBy: [
      { isFavorite: "desc" },
      { expiryDate: "asc" },
    ],
  });

  // Never return encrypted card numbers — only the hint
  const safe = cards.map((c) => ({
    id:               c.id,
    networkId:        c.networkId,
    networkName:      c.network?.name ?? null,
    networkLogo:      c.network?.logoUrl ?? null,
    storeSpecificName: c.storeSpecificName,
    cardNumberHint:   c.cardNumberHint,
    expiryDate:       c.expiryDate,
    balance:          Number(c.balance),
    currency:         c.currency,
    isFavorite:       c.isFavorite,
    isArchived:       c.isArchived,
    usageCount:       c.usageCount,
    lastUsedAt:       c.lastUsedAt,
    createdAt:        c.createdAt,
  }));

  return NextResponse.json(safe);
}

// ── POST ──────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const authError = await requireAuth(req);
  if (authError) return authError;
  const userId = getUserId(req);

  let body: z.infer<typeof AddCardSchema>;
  try {
    body = AddCardSchema.parse(await req.json());
  } catch (err: any) {
    const message = err.errors?.[0]?.message ?? "קלט לא תקין";
    return NextResponse.json({ message }, { status: 400 });
  }

  const cardNumberEncrypted = encrypt(body.cardNumber);
  const cardNumberHint      = lastNChars(body.cardNumber, 4);

  const card = await prisma.giftCard.create({
    data: {
      userId,
      networkId:          body.networkId,
      storeSpecificName:  body.storeSpecificName,
      cardNumberEncrypted,
      cardNumberHint,
      expiryDate:         new Date(body.expiryDate),
      balance:            body.balance,
      isFavorite:         body.isFavorite ?? false,
    },
    select: {
      id: true, cardNumberHint: true, expiryDate: true,
      balance: true, isFavorite: true, networkId: true,
    },
  });

  return NextResponse.json(card, { status: 201 });
}
