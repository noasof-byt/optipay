/**
 * GET  /api/wallet/memberships  — list user's club memberships
 * POST /api/wallet/memberships  — add a new membership
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth, getUserId } from "@/server/auth/middleware";
import { prisma }                 from "@/lib/prisma";

const AddSchema = z.object({
  clubId:           z.string().uuid(),
  isPaidMembership: z.boolean().optional(),
  expiryDate:       z.string().optional().nullable(),
});

export async function GET(req: NextRequest) {
  const authError = await requireAuth(req);
  if (authError) return authError;
  const userId = getUserId(req);

  const memberships = await prisma.userClubMembership.findMany({
    where:   { userId, isActive: true },
    include: { club: { select: { id: true, name: true, logoUrl: true, baseDiscountPercentage: true } } },
    orderBy: { club: { name: "asc" } },
  });

  return NextResponse.json(memberships.map((m) => ({
    id:               m.id,
    clubId:           m.clubId,
    clubName:         m.club.name,
    clubLogo:         m.club.logoUrl,
    baseDiscount:     Number(m.club.baseDiscountPercentage),
    isPaidMembership: m.isPaidMembership,
    expiryDate:       m.expiryDate,
    lastUsedAt:       m.lastUsedAt,
  })));
}

export async function POST(req: NextRequest) {
  const authError = await requireAuth(req);
  if (authError) return authError;
  const userId = getUserId(req);

  let body: z.infer<typeof AddSchema>;
  try {
    body = AddSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ message: "קלט לא תקין" }, { status: 400 });
  }

  const club = await prisma.club.findUnique({
    where: { id: body.clubId },
    select: { id: true },
  });
  if (!club) {
    return NextResponse.json({ message: "מועדון לא נמצא" }, { status: 404 });
  }

  // Upsert — if they already had this club and it was inactive, reactivate it
  const membership = await prisma.userClubMembership.upsert({
    where:  { userId_clubId: { userId, clubId: body.clubId } },
    update: {
      isActive:         true,
      isPaidMembership: body.isPaidMembership ?? false,
      expiryDate:       body.expiryDate ? new Date(body.expiryDate) : null,
    },
    create: {
      userId,
      clubId:           body.clubId,
      isPaidMembership: body.isPaidMembership ?? false,
      expiryDate:       body.expiryDate ? new Date(body.expiryDate) : null,
    },
    select: { id: true, clubId: true, isPaidMembership: true },
  });

  return NextResponse.json(membership, { status: 201 });
}
