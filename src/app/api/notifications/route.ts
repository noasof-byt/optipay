export const dynamic = 'force-dynamic'

/**
 * GET   /api/notifications        — list user notifications
 * PATCH /api/notifications/[id]   — mark as read  (handled inline via ?id=)
 * PATCH /api/notifications        — mark ALL as read (?all=true)
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAuth, getUserId }    from "@/server/auth/middleware";
import { prisma }                    from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const authError = await requireAuth(req);
  if (authError) return authError;
  const userId = getUserId(req);

  // Fast path — only return unread count (used by TopBar bell)
  if (req.nextUrl.searchParams.get("unreadOnly") === "true") {
    const unreadCount = await prisma.notification.count({
      where: { userId, isRead: false },
    });
    return NextResponse.json({ unreadCount });
  }

  const notifications = await prisma.notification.findMany({
    where:   { userId },
    orderBy: { createdAt: "desc" },
    take:    50,
  });

  const unreadCount = await prisma.notification.count({
    where: { userId, isRead: false },
  });

  return NextResponse.json({ notifications, unreadCount });
}

export async function PATCH(req: NextRequest) {
  const authError = await requireAuth(req);
  if (authError) return authError;
  const userId = getUserId(req);

  const all = req.nextUrl.searchParams.get("all") === "true";
  const id  = req.nextUrl.searchParams.get("id");

  if (all) {
    await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data:  { isRead: true },
    });
  } else if (id) {
    await prisma.notification.updateMany({
      where: { id, userId },
      data:  { isRead: true },
    });
  }

  return NextResponse.json({ message: "עודכן" });
}