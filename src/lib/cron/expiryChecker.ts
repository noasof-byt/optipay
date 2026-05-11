import "server-only";
/**
 * Expiry Checker — Vercel Cron worker
 *
 * Runs daily to:
 *   1. Find gift cards expiring within 30 days → push notification per user
 *   2. Find club memberships expiring within 30 days → push notification per user
 *
 * Deduplicates: skips cards/memberships for which a notification was already
 * created today (checks Notification.payload for the item id).
 *
 * Called from /api/cron/scrape — never directly.
 */

import webpush, { type PushSubscription as WebPushSubscription } from "web-push";
import { prisma }  from "@/lib/prisma";
import { logger }  from "@/lib/logger";

// ── VAPID setup (runs once at module load) ────────────────────────────────────
const VAPID_SUBJECT = process.env.VAPID_SUBJECT ?? "mailto:noreply@optipay.co.il";
const VAPID_PUBLIC  = process.env.NEXT_PUBLIC_VAPID_KEY ?? "";
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY     ?? "";

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
}

// ─────────────────────────────────────────────────────────────────────────────

interface PushPayload {
  title: string;
  body:  string;
  url?:  string;
}

async function sendPushNotification(
  sub: { endpoint: string; p256dhKey: string; authKey: string },
  payload: PushPayload
): Promise<boolean> {
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) return false;

  const subscription: WebPushSubscription = {
    endpoint: sub.endpoint,
    keys: { p256dh: sub.p256dhKey, auth: sub.authKey },
  };

  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload));
    return true;
  } catch (err: any) {
    // 410 Gone = subscription expired — deactivate it
    if (err?.statusCode === 410) {
      await prisma.pushSubscription.updateMany({
        where: { endpoint: sub.endpoint },
        data:  { isActive: false },
      }).catch(() => {});
    }
    logger.warn("[CRON] Push send failed", { endpoint: sub.endpoint, err: String(err) });
    return false;
  }
}

/** Returns true if we already sent a notification of this type for this item today */
async function alreadyNotifiedToday(userId: string, type: string, itemId: string): Promise<boolean> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const existing = await prisma.notification.findFirst({
    where: {
      userId,
      type,
      createdAt: { gte: todayStart },
      payload: { contains: itemId },
    },
  });

  return !!existing;
}

// ─────────────────────────────────────────────────────────────────────────────

export async function runExpiryChecker(): Promise<void> {
  logger.info("[CRON] Expiry checker started");

  const today          = new Date();
  const thirtyDaysOut  = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  let cardsSent   = 0;
  let membsSent   = 0;

  // ── 1. Gift cards expiring within 30 days ────────────────────────────────
  const expiringCards = await prisma.giftCard.findMany({
    where: {
      deletedAt:  null,
      isArchived: false,
      expiryDate: { gte: today, lte: thirtyDaysOut },
    },
    include: {
      user: {
        select: {
          id:                true,
          displayName:       true,
          pushSubscriptions: {
            where:  { isActive: true },
            select: { endpoint: true, p256dhKey: true, authKey: true },
          },
        },
      },
      network: { select: { name: true } },
    },
  });

  for (const card of expiringCards) {
    const { user, network, expiryDate, balance, id: cardId } = card;

    if (!user.pushSubscriptions.length) continue;
    if (await alreadyNotifiedToday(user.id, "CARD_EXPIRING", cardId)) continue;

    const daysLeft = Math.ceil((expiryDate.getTime() - today.getTime()) / 86_400_000);
    const networkName = network?.name ?? "מתנה";
    const title = "⚠️ כרטיס עומד לפוג";
    const body  = `כרטיס ${networkName} עם יתרה של ₪${Number(balance).toFixed(0)} יפוג בעוד ${daysLeft} ימים`;

    // Save notification record
    await prisma.notification.create({
      data: {
        userId:  user.id,
        type:    "CARD_EXPIRING",
        title,
        body,
        payload: JSON.stringify({ cardId, daysLeft }),
        isSent:  false,
      },
    });

    // Send to all active subscriptions for this user
    let anySent = false;
    for (const sub of user.pushSubscriptions) {
      const sent = await sendPushNotification(sub, { title, body, url: "/wallet" });
      if (sent) anySent = true;
    }

    if (anySent) {
      // Mark as sent
      await prisma.notification.updateMany({
        where: {
          userId:  user.id,
          type:    "CARD_EXPIRING",
          payload: { contains: cardId },
          isSent:  false,
        },
        data: { isSent: true, sentAt: new Date() },
      });
      cardsSent++;
      logger.info(`[CRON] Card expiry notification sent`, {
        userId: user.id, cardId, daysLeft, networkName,
      });
    }
  }

  // ── 2. Club memberships expiring within 30 days ───────────────────────────
  const expiringMemberships = await prisma.userClubMembership.findMany({
    where: {
      isActive:   true,
      expiryDate: { gte: today, lte: thirtyDaysOut },
    },
    include: {
      user: {
        select: {
          id:                true,
          displayName:       true,
          pushSubscriptions: {
            where:  { isActive: true },
            select: { endpoint: true, p256dhKey: true, authKey: true },
          },
        },
      },
      club: { select: { name: true } },
    },
  });

  for (const memb of expiringMemberships) {
    const { user, club, expiryDate, id: membId } = memb;

    if (!user.pushSubscriptions.length) continue;
    if (await alreadyNotifiedToday(user.id, "CARD_EXPIRING", membId)) continue;

    const daysLeft = Math.ceil((expiryDate!.getTime() - today.getTime()) / 86_400_000);
    const title = "⚠️ חברות מועדון עומדת לפוג";
    const body  = `החברות שלך ב${club.name} תפוג בעוד ${daysLeft} ימים`;

    await prisma.notification.create({
      data: {
        userId:  user.id,
        type:    "CARD_EXPIRING",
        title,
        body,
        payload: JSON.stringify({ membId, daysLeft }),
        isSent:  false,
      },
    });

    let anySent = false;
    for (const sub of user.pushSubscriptions) {
      const sent = await sendPushNotification(sub, { title, body, url: "/wallet" });
      if (sent) anySent = true;
    }

    if (anySent) {
      await prisma.notification.updateMany({
        where: {
          userId:  user.id,
          type:    "CARD_EXPIRING",
          payload: { contains: membId },
          isSent:  false,
        },
        data: { isSent: true, sentAt: new Date() },
      });
      membsSent++;
      logger.info(`[CRON] Membership expiry notification sent`, {
        userId: user.id, membId, daysLeft, clubName: club.name,
      });
    }
  }

  logger.info("[CRON] Expiry checker finished", { cardsSent, membsSent });
}
