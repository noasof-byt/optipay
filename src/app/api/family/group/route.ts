export const dynamic = 'force-dynamic'

/**
 * GET  /api/family/group  — get the caller's family group (or null)
 * DELETE /api/family/group — leave / disband the group
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAuth, getUserId }    from "@/server/auth/middleware";
import { prisma }                    from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const authError = await requireAuth(req);
  if (authError) return authError;
  const userId = getUserId(req);

  // Check if user owns a group
  const ownedGroup = await prisma.familyGroup.findUnique({
    where:   { ownerId: userId },
    include: {
      members: {
        include: { user: { select: { id: true, displayName: true, email: true, avatarUrl: true } } },
      },
      sharedItems: {
        include: {
          giftCard:   { include: { network: { select: { name: true } } } },
          membership: { include: { club:    { select: { name: true } } } },
        },
      },
    },
  });

  if (ownedGroup) {
    return NextResponse.json(formatGroup(ownedGroup, userId, true));
  }

  // Check if user is a member
  const membership = await prisma.familyGroupMember.findUnique({
    where:   { userId },
    include: {
      familyGroup: {
        include: {
          members: {
            include: { user: { select: { id: true, displayName: true, email: true, avatarUrl: true } } },
          },
          sharedItems: {
            include: {
              giftCard:   { include: { network: { select: { name: true } } } },
              membership: { include: { club:    { select: { name: true } } } },
            },
          },
        },
      },
    },
  });

  if (membership) {
    return NextResponse.json(formatGroup(membership.familyGroup, userId, false));
  }

  return NextResponse.json(null);
}

export async function DELETE(req: NextRequest) {
  const authError = await requireAuth(req);
  if (authError) return authError;
  const userId = getUserId(req);

  // If owner — disband group (delete all members first)
  const ownedGroup = await prisma.familyGroup.findUnique({ where: { ownerId: userId } });
  if (ownedGroup) {
    await prisma.familyGroupMember.deleteMany({ where: { familyGroupId: ownedGroup.id } });
    await prisma.familySharedItem.deleteMany({ where: { familyGroupId: ownedGroup.id } });
    await prisma.familyGroup.delete({ where: { id: ownedGroup.id } });
    return NextResponse.json({ success: true, disbanded: true });
  }

  // If member — just leave
  const member = await prisma.familyGroupMember.findUnique({ where: { userId } });
  if (member) {
    await prisma.familyGroupMember.delete({ where: { userId } });
    return NextResponse.json({ success: true, left: true });
  }

  return NextResponse.json({ message: "אינך חבר בקבוצה משפחתית" }, { status: 404 });
}

// ─────────────────────────────────────────────────────────────────────────────

function formatGroup(group: any, userId: string, isOwner: boolean) {
  return {
    id:      group.id,
    name:    group.name,
    isOwner,
    members: group.members.map((m: any) => ({
      id:          m.user.id,
      displayName: m.user.displayName ?? m.user.email,
      email:       m.user.email,
      avatarUrl:   m.user.avatarUrl,
      role:        m.role,
      isMe:        m.user.id === userId,
    })),
    sharedItems: group.sharedItems.map((item: any) => ({
      id:       item.id,
      itemType: item.itemType,
      label:    item.itemType === "GIFT_CARD"
        ? `כרטיס ${item.giftCard?.network?.name ?? "מתנה"}`
        : `מועדון ${item.membership?.club?.name ?? ""}`,
    })),
  };
}