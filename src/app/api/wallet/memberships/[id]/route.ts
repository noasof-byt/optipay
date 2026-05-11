export const dynamic = 'force-dynamic'

/**
 * GET    /api/wallet/memberships/[id]  — membership detail
 * PATCH  /api/wallet/memberships/[id]  — update expiryDate / isPaidMembership / monthlyFee
 * DELETE /api/wallet/memberships/[id]  — hard-delete (can be re-added anytime)
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth, getUserId } from "@/server/auth/middleware";
import { prisma }                 from "@/lib/prisma";

// ── GET ───────────────────────────────────────────────────────────────────────
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
  return NextResponse.json({
    membership: { ...membership, monthlyFee: Number(membership.monthlyFee) },
    type: "membership",
  });
}

// ── PATCH ─────────────────────────────────────────────────────────────────────
const PatchSchema = z.object({
  expiryDate: z.string().refine((d) => new Date(d) > new Date(), {
    message: "תאריך התפוגה חייב להיות בעתיד",
  }).optional(),
  isPaidMembership: z.boolean().optional(),
  monthlyFee:       z.number().min(0).optional(),
}).refine((d) => Object.keys(d).length > 0, { message: "אין שדות לעדכון" });

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const authError = await requireAuth(req);
  if (authError) return authError;
  const userId = getUserId(req);

  const existing = await prisma.userClubMembership.findFirst({
    where:  { id: params.id, userId },
    select: { id: true },
  });
  if (!existing) return NextResponse.json({ message: "חברות לא נמצאה" }, { status: 404 });

  let body: z.infer<typeof PatchSchema>;
  try {
    body = PatchSchema.parse(await req.json());
  } catch (err: any) {
    return NextResponse.json(
      { message: err.errors?.[0]?.message ?? "קלט לא תקין" },
      { status: 400 }
    );
  }

  const updated = await prisma.userClubMembership.update({
    where: { id: params.id },
    data: {
      ...(body.expiryDate       !== undefined && { expiryDate: new Date(body.expiryDate) }),
      ...(body.isPaidMembership !== undefined && { isPaidMembership: body.isPaidMembership }),
      ...(body.monthlyFee       !== undefined && { monthlyFee: body.monthlyFee }),
    },
    select: { id: true, expiryDate: true, isPaidMembership: true, monthlyFee: true },
  });

  return NextResponse.json({ ...updated, monthlyFee: Number(updated.monthlyFee) });
}

// ── DELETE (hard-delete) ──────────────────────────────────────────────────────
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

  await prisma.userClubMembership.delete({ where: { id: params.id } });

  return NextResponse.json({ message: "החברות הוסרה" });
}