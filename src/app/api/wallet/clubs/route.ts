/**
 * GET /api/wallet/clubs
 * Returns all active clubs for dropdown population.
 */
import { NextResponse } from "next/server";
import { prisma }       from "@/lib/prisma";

export async function GET() {
  try {
    const clubs = await prisma.club.findMany({
      where:   { isActive: true },
      orderBy: { name: "asc" },
      select:  { id: true, name: true, logoUrl: true, baseDiscountPercentage: true, isPaidMembership: true },
    });

    return NextResponse.json(
      clubs.map((c) => ({
        id:                     c.id,
        name:                   c.name,
        logoUrl:                c.logoUrl,
        baseDiscountPercentage: Number(c.baseDiscountPercentage),
        isPaidMembership:       c.isPaidMembership,
      }))
    );
  } catch (err) {
    console.error("[wallet/clubs GET]", err);
    return NextResponse.json({ message: "שגיאת שרת" }, { status: 500 });
  }
}
