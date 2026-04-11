import { NextRequest, NextResponse } from "next/server";
import { requireAuth, getUserId } from "@/server/auth/middleware";
import { prisma }                 from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const authError = await requireAuth(req);
  if (authError) return authError;
  const userId = getUserId(req);

  const membership = await prisma.userClubMembership.findFirst({
    where:   { id: params.id, userId },
    include: { club: { select: { name: true, description: true, logoUrl: true } } },
  });

  if (!membership) return NextResponse.json({ message: "חברות לא נמצאה" }, { status: 404 });
  return NextResponse.json({ membership, type: "membership" });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const authError = await requireAuth(req);
  if (authError) return authError;
  const userId = getUserId(req);

  const membership = await prisma.userClubMembership.findFirst({
    where:  { id: params.id, userId },
    select: { id: true },
  });
  if (!membership) {
    return NextResponse.json({ message: "חברות לא נמצאה" }, { status: 404 });
  }

  await prisma.userClubMembership.update({
    where: { id: params.id },
    data:  { isActive: false },
  });

  return NextResponse.json({ message: "החברות הוסרה" });
}
