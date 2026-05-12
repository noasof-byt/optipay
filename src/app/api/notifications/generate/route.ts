export const dynamic = 'force-dynamic'

/**
 * POST /api/notifications/generate
 * Checks user's cards and memberships expiring within 30 days and creates
 * notification records (idempotent — skips if same notification exists within 7 days).
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAuth, getUserId }    from "@/server/auth/middleware";
import { prisma }                    from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const authError = await requireAuth(req);
  if (authError) return authError;
  const userId = getUserId(req);

  const now       = new Date();
  const in30Days  = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // Build set of recently sent notifications to avoid duplicates: "TYPE:payload"
  const recentNotifs = await prisma.notification.findMany({
    where:  { userId, createdAt: { gte: sevenDaysAgo } },
    select: { type: true, payload: true },
  });
  const notifSet = new Set(
    recentNotifs
      .filter((n) => n.payload)
      .map((n) => `${n.type}:${n.payload}`)
  );

  let created = 0;

  // ── Gift cards expiring within 30 days ──────────────────────────────────────
  const cards = await prisma.giftCard.findMany({
    where: {
      userId,
      isArchived: false,
      deletedAt:  null,
      expiryDate: { gte: now, lte: in30Days },
    },
    include: { network: { select: { name: true } } },
  });

  for (const card of cards) {
    const key = `CARD_EXPIRING:${card.id}`;
    if (notifSet.has(key)) continue;

    const daysLeft = Math.ceil((card.expiryDate.getTime() - now.getTime()) / 86_400_000);
    const cardName = card.network?.name ?? card.storeSpecificName ?? "כרטיס מתנה";

    await prisma.notification.create({
      data: {
        userId,
        type:    "CARD_EXPIRING",
        title:   `${cardName} פוקע בעוד ${daysLeft} ימים`,
        body:    `יתרת הכרטיס שלך היא ₪${Number(card.balance).toFixed(0)}. השתמש בו לפני שיפוג התוקף.`,
        payload: card.id,
        isSent:  true,
        sentAt:  now,
      },
    });
    created++;
  }

  // ── Memberships expiring within 30 days ─────────────────────────────────────
  const memberships = await prisma.userClubMembership.findMany({
    where: {
      userId,
      isActive:   true,
      expiryDate: { not: null, gte: now, lte: in30Days },
    },
    include: { club: { select: { name: true } } },
  });

  for (const m of memberships) {
    const key = `SYSTEM:${m.id}`;
    if (notifSet.has(key)) continue;

    const daysLeft = Math.ceil((m.expiryDate!.getTime() - now.getTime()) / 86_400_000);
    const action   = m.isPaidMembership ? "שקול לחדש או לבטל." : "בדוק אפשרות חידוש.";

    await prisma.notification.create({
      data: {
        userId,
        type:    "SYSTEM",
        title:   `חברות ל${m.club.name} פוקעת בעוד ${daysLeft} ימים`,
        body:    action,
        payload: m.id,
        isSent:  true,
        sentAt:  now,
      },
    });
    created++;
  }

  return NextResponse.json({ created });
}
