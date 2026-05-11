export const dynamic = 'force-dynamic'

/**
 * GET /api/clubs — list all active system clubs
 *
 * On first call, upserts the canonical Israeli consumer clubs into the DB
 * so the dropdown is never empty regardless of DB seed state.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const SUPPORTED_CLUBS = [
  { name: "חבר",       nameEn: "Hever",     baseDiscountPercentage: 10, isPaidMembership: false },
  { name: "אשמורת",    nameEn: "Ashmoret",  baseDiscountPercentage: 10, isPaidMembership: true  },
  { name: "פייס פלוס", nameEn: "Pais Plus", baseDiscountPercentage: 8,  isPaidMembership: false },
  { name: "נופשית",    nameEn: "Nofeshit",  baseDiscountPercentage: 5,  isPaidMembership: false },
  { name: "מקס",       nameEn: "Max",       baseDiscountPercentage: 5,  isPaidMembership: false },
  { name: "ישראכרט",   nameEn: "Isracard",  baseDiscountPercentage: 5,  isPaidMembership: false },
] as const;

export async function GET() {
  // Upsert supported clubs to ensure they always exist in the DB
  await Promise.all(
    SUPPORTED_CLUBS.map((c) =>
      prisma.club.upsert({
        where:  { name: c.name },
        update: {},
        create: {
          name:                  c.name,
          nameEn:                c.nameEn,
          baseDiscountPercentage: c.baseDiscountPercentage,
          isPaidMembership:      c.isPaidMembership,
          isActive:              true,
        },
      })
    )
  );

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