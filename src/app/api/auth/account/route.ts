export const dynamic = 'force-dynamic'

/**
 * DELETE /api/auth/account
 * Soft-deletes the authenticated user's account.
 * Sets isDeleted + deletedAt. Does NOT hard-delete any records.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAuth, getUserId }    from "@/server/auth/middleware";
import { prisma }                    from "@/lib/prisma";

export async function DELETE(req: NextRequest) {
  const authError = await requireAuth(req);
  if (authError) return authError;
  const userId = getUserId(req);

  await prisma.user.update({
    where: { id: userId },
    data: {
      isDeleted: true,
      deletedAt: new Date(),
      // Deactivate push subscriptions so we stop sending notifications
      pushSubscriptions: {
        updateMany: { where: {}, data: { isActive: false } },
      },
    },
  });

  // Clear the auth cookie
  const res = NextResponse.json({ message: "החשבון נמחק בהצלחה" });
  res.cookies.set("optipay_token", "", {
    httpOnly: true,
    secure:   process.env.NODE_ENV === "production",
    sameSite: "lax",
    path:     "/",
    maxAge:   0,
  });

  return res;
}