/**
 * Expired Card Archiver
 *
 * Finds all non-archived gift cards whose expiryDate < now and moves them
 * to the archive (isArchived=true). Creates a Notification for each user
 * so they're aware a card has expired.
 */

import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

export async function runExpiredCardArchiver(): Promise<void> {
  const now = new Date();

  const expiredCards = await prisma.giftCard.findMany({
    where: {
      isArchived:  false,
      expiryDate:  { lt: now },
    },
    select: {
      id:         true,
      userId:     true,
      network:    { select: { name: true } },
      storeSpecificName: true,
      cardNumberHint: true,
    },
  });

  if (!expiredCards.length) {
    logger.info("Expired card archiver: no cards to archive");
    return;
  }

  // Batch archive
  await prisma.giftCard.updateMany({
    where: { id: { in: expiredCards.map((c) => c.id) } },
    data:  { isArchived: true, archivedAt: now },
  });

  // Create one notification per card
  await prisma.notification.createMany({
    data: expiredCards.map((card) => ({
      userId:  card.userId,
      type:    "CARD_EXPIRING" as const,
      title:   "כרטיס פג תוקף",
      body:    `כרטיס ${card.network?.name ?? card.storeSpecificName ?? "מתנה"} (••••${card.cardNumberHint ?? ""}) הועבר לארכיון`,
      payload: JSON.stringify({ cardId: card.id }),
    })),
  });

  logger.info("Expired card archiver complete", { archived: expiredCards.length });
}
