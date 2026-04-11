/**
 * Web Push Service
 *
 * Sends push notifications to all active subscriptions for a given user.
 * Uses the `web-push` library with VAPID authentication.
 *
 * VAPID keys must be generated once and stored in env vars:
 *   npx web-push generate-vapid-keys
 */

import webpush from "web-push";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

// Configure VAPID once on module load
webpush.setVapidDetails(
  process.env.VAPID_SUBJECT!,
  process.env.VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

export interface PushPayload {
  title:  string;
  body:   string;
  url?:   string;
  icon?:  string;
  badge?: string;
  tag?:   string;
}

/**
 * Send a push notification to all active subscriptions of a user.
 * Inactive / expired subscriptions are cleaned up automatically.
 */
export async function sendPushToUser(
  userId:  string,
  payload: PushPayload
): Promise<void> {
  const subscriptions = await prisma.pushSubscription.findMany({
    where:  { userId, isActive: true },
    select: { id: true, endpoint: true, p256dhKey: true, authKey: true },
  });

  if (!subscriptions.length) return;

  const json = JSON.stringify({
    title:  payload.title,
    body:   payload.body,
    icon:   payload.icon   ?? "/icons/icon-192x192.png",
    badge:  payload.badge  ?? "/icons/badge-96x96.png",
    tag:    payload.tag    ?? "optipay",
    data:   { url: payload.url ?? "/" },
  });

  const results = await Promise.allSettled(
    subscriptions.map((sub) =>
      webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys:     { p256dh: sub.p256dhKey, auth: sub.authKey },
        },
        json,
        { TTL: 24 * 60 * 60 } // message lives on push server for 24h
      )
    )
  );

  // Deactivate subscriptions that returned 410 Gone (user unsubscribed)
  const gone: string[] = [];
  results.forEach((result, i) => {
    if (result.status === "rejected") {
      const err = result.reason as { statusCode?: number };
      if (err?.statusCode === 410) {
        gone.push(subscriptions[i].id);
      } else {
        logger.warn("Push send failed", {
          userId,
          endpoint: subscriptions[i].endpoint,
          err:      String(result.reason),
        });
      }
    }
  });

  if (gone.length) {
    await prisma.pushSubscription.updateMany({
      where: { id: { in: gone } },
      data:  { isActive: false },
    });
    logger.info("Deactivated stale push subscriptions", { count: gone.length });
  }
}

/**
 * Broadcast a push notification to ALL users (used by admin panel).
 * Processes in batches of 100 to avoid exhausting the connection pool.
 */
export async function broadcastPush(payload: PushPayload): Promise<void> {
  const BATCH = 100;
  let skip = 0;

  while (true) {
    const userIds = await prisma.pushSubscription.findMany({
      where:   { isActive: true },
      select:  { userId: true },
      distinct: ["userId"],
      skip,
      take:    BATCH,
    });

    if (!userIds.length) break;

    await Promise.allSettled(
      userIds.map(({ userId }) => sendPushToUser(userId, payload))
    );

    skip += BATCH;
  }
}
