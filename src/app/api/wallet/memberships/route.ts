export const dynamic = 'force-dynamic'

/**
 * GET  /api/wallet/memberships  — list user's club memberships (own + family-shared)
 * POST /api/wallet/memberships  — add a new membership
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth, getUserId } from "@/server/auth/middleware";
import { prisma }                 from "@/lib/prisma";

const AddSchema = z.object({
  clubId:           z.string().uuid().optional(),
  clubName:         z.string().max(120).optional(),
  isPaidMembership: z.boolean().optional(),
  monthlyFee:       z.number().min(0).optional(),
  expiryDate:       z.string().refine((d) => new Date(d) > new Date(), {
    message: "תאריך התפוגה חייב להיות בעתיד",
  }),
}).refine((d) => d.clubId || d.clubName, { message: "נא לבחור מועדון" });

const MEMBERSHIP_INCLUDE = {
  club: { select: { id: true, name: true, logoUrl: true, baseDiscountPercentage: true } },
} as const;

export async function GET(req: NextRequest) {
  const authError = await requireAuth(req);
  if (authError) return authError;
  const userId = getUserId(req);

  try {
    // ── 1. Own active memberships ─────────────────────────────────────────
    const ownMemberships = await prisma.userClubMembership.findMany({
      where:   { userId, isActive: true },
      include: MEMBERSHIP_INCLUDE,
      orderBy: { club: { name: "asc" } },
    });

    type MembershipWithClub = typeof ownMemberships[0];

    function mapMembership(
      m: MembershipWithClub,
      extra?: { isShared?: boolean; sharedBy?: string | null }
    ) {
      return {
        id:                  m.id,
        clubId:              m.clubId,
        clubName:            m.club.name,
        clubLogo:            m.club.logoUrl,
        baseDiscount:        Number(m.club.baseDiscountPercentage),
        isPaidMembership:    m.isPaidMembership,
        monthlyFee:          Number(m.monthlyFee),
        expiryDate:          m.expiryDate,
        lastUsedAt:          m.lastUsedAt,
        isSharedWithFamily:  extra?.isShared ? false : m.isSharedWithFamily,
        isShared:            extra?.isShared ?? false,
        sharedBy:            extra?.sharedBy ?? null,
      };
    }

    const result = ownMemberships.map((m) => mapMembership(m));
    const ownClubIds = new Set(result.map((m) => m.clubId));

    // ── 2. Family-shared memberships from other members ───────────────────
    const familyMember = await prisma.familyGroupMember.findFirst({
      where:  { userId },
      select: { familyGroupId: true },
    });

    if (familyMember) {
      const otherMembers = await prisma.familyGroupMember.findMany({
        where:   { familyGroupId: familyMember.familyGroupId, userId: { not: userId } },
        include: { user: { select: { displayName: true, email: true } } },
      });

      for (const member of otherMembers) {
        const sharedMemberships = await prisma.userClubMembership.findMany({
          where: {
            userId:             member.userId,
            isSharedWithFamily: true,
            isActive:           true,
          },
          include: MEMBERSHIP_INCLUDE,
        });
        const sharedBy = member.user.displayName ?? member.user.email ?? null;
        console.log(`[FAMILY] Found ${sharedMemberships.length} shared memberships from ${sharedBy}`);
        for (const m of sharedMemberships) {
          if (ownClubIds.has(m.clubId)) continue; // user already has this club
          result.push(mapMembership(m, { isShared: true, sharedBy }));
        }
      }
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error("[wallet/memberships GET]", err);
    return NextResponse.json({ message: "שגיאת שרת" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const authError = await requireAuth(req);
  if (authError) return authError;
  const userId = getUserId(req);

  let body: z.infer<typeof AddSchema>;
  try {
    const raw = await req.json();
    console.log("[wallet/memberships POST] received:", raw);
    body = AddSchema.parse(raw);
  } catch (err: any) {
    const message = err.errors?.[0]?.message ?? "קלט לא תקין";
    console.error("[wallet/memberships POST] validation error:", message);
    return NextResponse.json({ message }, { status: 400 });
  }

  try {
    let resolvedClubId = body.clubId;
    if (!resolvedClubId && body.clubName) {
      const club = await prisma.club.upsert({
        where:  { name: body.clubName },
        update: {},
        create: { name: body.clubName, baseDiscountPercentage: 5, isActive: true },
      });
      resolvedClubId = club.id;
    }

    if (!resolvedClubId) {
      return NextResponse.json({ message: "נא לבחור מועדון" }, { status: 400 });
    }

    const club = await prisma.club.findUnique({
      where:  { id: resolvedClubId },
      select: { id: true },
    });
    if (!club) {
      return NextResponse.json({ message: "מועדון לא נמצא" }, { status: 404 });
    }

    console.log("[wallet/memberships POST] upserting membership for club:", resolvedClubId);

    const membership = await prisma.userClubMembership.upsert({
      where:  { userId_clubId: { userId, clubId: resolvedClubId } },
      update: {
        isActive:         true,
        isPaidMembership: body.isPaidMembership ?? false,
        monthlyFee:       body.monthlyFee ?? 0,
        expiryDate:       new Date(body.expiryDate),
      },
      create: {
        userId,
        clubId:           resolvedClubId,
        isPaidMembership: body.isPaidMembership ?? false,
        monthlyFee:       body.monthlyFee ?? 0,
        expiryDate:       new Date(body.expiryDate),
      },
      select: { id: true, clubId: true, isPaidMembership: true, monthlyFee: true, expiryDate: true },
    });

    console.log("[wallet/memberships POST] saved:", membership.id);
    return NextResponse.json(
      { ...membership, monthlyFee: Number(membership.monthlyFee) },
      { status: 201 }
    );
  } catch (err) {
    console.error("[wallet/memberships POST] prisma error:", err);
    return NextResponse.json({ message: "שגיאת שרת בשמירת החברות" }, { status: 500 });
  }
}
