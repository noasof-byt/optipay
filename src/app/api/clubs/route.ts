/** GET /api/clubs — list all active system clubs */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const clubs = await prisma.club.findMany({
    where:   { isActive: true },
    orderBy: { name: "asc" },
    select:  {
      id: true, name: true, logoUrl: true,
      baseDiscountPercentage: true, isPaidMembership: true,
      description: true,
    },
  });
  return NextResponse.json(clubs);
}
