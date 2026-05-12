export const dynamic = 'force-dynamic'

/**
 * GET  /api/wallet/cards  — list active gift cards (own + family-shared)
 * POST /api/wallet/cards  — add a new gift card
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth, getUserId } from "@/server/auth/middleware";
import { prisma }                 from "@/lib/prisma";
import { encrypt, decrypt, lastNChars } from "@/lib/encryption";

// ── Validation ────────────────────────────────────────────────────────────────
const AddCardSchema = z.object({
  networkId:         z.string().uuid().optional(),
  networkName:       z.string().max(120).optional(),
  storeSpecificName: z.string().max(80).optional(),
  cardNumber: z
    .string()
    .min(4, "מספר כרטיס חייב להכיל לפחות 4 ספרות")
    .max(30)
    .regex(/^\d+$/, "מספר כרטיס חייב להכיל ספרות בלבד")
    .optional(),
  expiryDate: z.string().refine((d) => new Date(d) > new Date(), {
    message: "תאריך התפוגה חייב להיות בעתיד",
  }),
  balance:    z.number().min(0, "היתרה חייבת להיות אפס או יותר"),
  isFavorite: z.boolean().optional(),
});

// ── Shared include clause ─────────────────────────────────────────────────────
const CARD_INCLUDE = { network: { select: { id: true, name: true, logoUrl: true } } } as const;

// ── GET ───────────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const authError = await requireAuth(req);
  if (authError) return authError;
  const userId = getUserId(req);

  try {
    const sortParam = req.nextUrl.searchParams.get("sort") ?? "expiry";
    const now = new Date();

    // ── 1. Own active cards ────────────────────────────────────────────────
    const ownCards = await prisma.giftCard.findMany({
      where:   { userId, isArchived: false, deletedAt: null, expiryDate: { gte: now } },
      include: CARD_INCLUDE,
    });

    type CardWithNetwork = typeof ownCards[0];

    function mapCard(
      c: CardWithNetwork,
      extra?: { isShared?: boolean; sharedBy?: string | null }
    ) {
      let cardNumber: string | null = null;
      try {
        cardNumber = c.cardNumberEncrypted ? decrypt(c.cardNumberEncrypted) : null;
      } catch {
        cardNumber = null;
      }
      return {
        id:                  c.id,
        networkId:           c.networkId,
        networkName:         c.network?.name ?? null,
        networkLogo:         c.network?.logoUrl ?? null,
        storeSpecificName:   c.storeSpecificName,
        cardNumberHint:      c.cardNumberHint,
        cardNumber,
        expiryDate:          c.expiryDate,
        balance:             Number(c.balance),
        currency:            c.currency,
        isFavorite:          c.isFavorite,
        isArchived:          c.isArchived,
        isSharedWithFamily:  extra?.isShared ? false : c.isSharedWithFamily,
        usageCount:          c.usageCount,
        lastUsedAt:          c.lastUsedAt,
        createdAt:           c.createdAt,
        isShared:            extra?.isShared ?? false,
        sharedBy:            extra?.sharedBy ?? null,
      };
    }

    const sorted = [...ownCards].sort((a, b) => {
      if (a.isFavorite !== b.isFavorite) return a.isFavorite ? -1 : 1;
      const aZero = Number(a.balance) === 0;
      const bZero = Number(b.balance) === 0;
      if (aZero !== bZero) return aZero ? 1 : -1;
      if (sortParam === "balance") return Number(b.balance) - Number(a.balance);
      return new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime();
    });

    const result = sorted.map((c) => mapCard(c));

    // ── 2. Family-shared cards from other members ──────────────────────────
    const familyMember = await prisma.familyGroupMember.findFirst({
      where:  { userId },
      select: { familyGroupId: true },
    });

    if (familyMember) {
      const otherMembers = await prisma.familyGroupMember.findMany({
        where:   { familyGroupId: familyMember.familyGroupId, userId: { not: userId } },
        include: { user: { select: { displayName: true, email: true } } },
      });

      for (const member of otherMembers) {
        const sharedCards = await prisma.giftCard.findMany({
          where: {
            userId:             member.userId,
            isSharedWithFamily: true,
            isArchived:         false,
            deletedAt:          null,
            expiryDate:         { gte: now },
          },
          include: CARD_INCLUDE,
        });
        const sharedBy = member.user.displayName ?? member.user.email ?? null;
        console.log(`[FAMILY] Found ${sharedCards.length} shared cards from ${sharedBy}`);
        for (const c of sharedCards) {
          result.push(mapCard(c, { isShared: true, sharedBy }));
        }
      }
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error("[wallet/cards GET]", err);
    return NextResponse.json({ message: "שגיאת שרת" }, { status: 500 });
  }
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

  try {
    let resolvedNetworkId: string | undefined = body.networkId;

    if (!resolvedNetworkId && body.networkName) {
      const network = await prisma.giftCardNetwork.upsert({
        where:  { name: body.networkName },
        update: {},
        create: { name: body.networkName, isActive: true },
      });
      resolvedNetworkId = network.id;
    }

    if (resolvedNetworkId) {
      const network = await prisma.giftCardNetwork.findUnique({
        where:  { id: resolvedNetworkId },
        select: { id: true },
      });
      if (!network) {
        return NextResponse.json({ message: "רשת כרטיסי מתנה לא נמצאה" }, { status: 400 });
      }
    }

    const cardNumberEncrypted = encrypt(body.cardNumber ?? "");
    const cardNumberHint      = body.cardNumber ? lastNChars(body.cardNumber, 4) : null;

    const card = await prisma.giftCard.create({
      data: {
        userId,
        networkId:          resolvedNetworkId,
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
  } catch (err) {
    console.error("[wallet/cards POST]", err);
    return NextResponse.json({ message: "שגיאת שרת בשמירת הכרטיס" }, { status: 500 });
  }
}
