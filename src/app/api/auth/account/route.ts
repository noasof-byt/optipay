/**
 * DELETE /api/auth/account
 * Permanently deletes the user's account (GDPR right to erasure).
 * Anonymises PII then marks isDeleted=true.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAuth, getUserId }    from "@/server/auth/middleware";
import { prisma }                    from "@/lib/prisma";

export async function DELETE(req: NextRequest) {
  const authError = await requireAuth(req);
  if (authError) return authError;
  const userId = getUserId(req);

  await prisma.$transaction([
    // Anonymise PII
    prisma.user.update({
      where: { id: userId },
      data: {
        email:        `deleted-${userId}@deleted.invalid`,
        displayName:  null,
        passwordHash: "DELETED",
        phoneNumber:  null,
        avatarUrl:    null,
        isDeleted:    true,
        deletedAt:    new Date(),
      },
    }),
    // Hard-delete gift cards (contains encrypted card numbers)
    prisma.giftCard.deleteMany({ where: { userId } }),
    // Hard-delete memberships
    prisma.userClubMembership.deleteMany({ where: { userId } }),
    // Clear sessions
    prisma.userSession.deleteMany({ where: { userId } }),
    // Clear push subscriptions
    prisma.pushSubscription.updateMany({
      where: { userId },
      data:  { isActive: false },
    }),
  ]);

  return NextResponse.json({ message: "החשבון נמחק בהצלחה" });
}
