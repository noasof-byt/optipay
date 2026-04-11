/**
 * Unused Membership Alert
 *
 * Finds paid club memberships that haven't been used in > 6 months
 * and notifies the user — they may be paying for something unused.
 */

import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { sendPushToUser } from "../../push/pushService";

const SIX_MONTHS_MS = 6 * 30 * 24 * 60 * 60 * 1000;
const REPEAT_GUARD_MS = 30 * 24 * 60 * 60 * 1000; // re-alert after 30 days max

export async function runUnusedMembershipAlert(): Promise<void> {
  const now        = new Date();
  const threshold  = new Date(now.getTime() - SIX_MONTHS_MS);

  const memberships = await prisma.userClubMembership.findMany({
    where: {
      isPaidMembership: true,
      isActive:         true,
      OR: [
        { lastUsedAt: { lt: threshold } },
        { lastUsedAt: null },
      ],
    },
    include: {
      club: { select: { name: true } },
    },
  });

  let sent = 0;

  for (const membership of memberships) {
    // Guard: don't spam the same membership alert more than once a month
    const recent = await prisma.notification.findFirst({
      where: {
        userId:    membership.userId,
        type:      "MEMBERSHIP_UNUSED",
        payload:   { contains: membership.id },
        createdAt: { gt: new Date(now.getTime() - REPEAT_GUARD_MS) },
      },
    });
    if (recent) continue;

    const title = "המועדון שלך לא בשימוש";
    const body  = `לא ניצלת את הטבות "${membership.club.name}" כבר יותר מ-6 חודשים. כדאי לבדוק!`;

    await prisma.notification.create({
      data: {
        userId:  membership.userId,
        type:    "MEMBERSHIP_UNUSED",
        title,
        body,
        payload: JSON.stringify({ membershipId: membership.id, clubName: membership.club.name }),
      },
    });

    await sendPushToUser(membership.userId, {
      title,
      body,
      url: "/wallet",
    });

    sent++;
  }

  logger.info("Unused membership alert complete", { sent, total: memberships.length });
}
