/**
 * Expiry Notifier
 *
 * Sends push notifications for gift cards expiring in ≤30 days.
 * Skips cards that already have a "CARD_EXPIRING" notification sent
 * in the last 7 days to avoid notification spam.
 */

import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { sendPushToUser } from "../../push/pushService";

const WARN_DAYS       = 30;
const REPEAT_GUARD_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export async function runExpiryNotifier(): Promise<void> {
  const now          = new Date();
  const warnDeadline = new Date(now.getTime() + WARN_DAYS * 24 * 60 * 60 * 1000);

  const cards = await prisma.giftCard.findMany({
    where: {
      isArchived: false,
      expiryDate: { gt: now, lte: warnDeadline },
    },
    select: {
      id:               true,
      userId:           true,
      expiryDate:       true,
      network:          { select: { name: true } },
      storeSpecificName: true,
      cardNumberHint:   true,
    },
  });

  let sent = 0;
  let skipped = 0;

  for (const card of cards) {
    // Check if we already notified about this card recently
    const recentNotif = await prisma.notification.findFirst({
      where: {
        userId:    card.userId,
        type:      "CARD_EXPIRING",
        payload:   { contains: card.id },
        createdAt: { gt: new Date(now.getTime() - REPEAT_GUARD_MS) },
      },
    });

    if (recentNotif) { skipped++; continue; }

    const cardLabel  = card.network?.name ?? card.storeSpecificName ?? "כרטיס מתנה";
    const daysLeft   = Math.ceil((card.expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    const title      = "⚠️ כרטיס פג תוקף בקרוב";
    const body       = `${cardLabel} (••••${card.cardNumberHint ?? ""}) יפוג בעוד ${daysLeft} ימים`;

    // DB record
    await prisma.notification.create({
      data: {
        userId:  card.userId,
        type:    "CARD_EXPIRING",
        title,
        body,
        payload: JSON.stringify({ cardId: card.id, daysLeft }),
      },
    });

    // Push to browser/device
    await sendPushToUser(card.userId, { title, body, url: "/wallet" });
    sent++;
  }

  logger.info("Expiry notifier complete", { sent, skipped, total: cards.length });
}
