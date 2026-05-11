/**
 * GET /api/wallet/networks
 *
 * Returns the list of gift card networks that OptiPay actually supports.
 * On first call, upserts the canonical supported-network records into the DB
 * so the dropdown is never empty regardless of DB seed state.
 */
import { NextResponse } from "next/server";
import { prisma }       from "@/lib/prisma";

const SUPPORTED_NETWORKS = [
  { name: "BuyMe",     nameEn: "BuyMe" },
  { name: "HTZone",    nameEn: "HTZone" },
  { name: "חבר",       nameEn: "Hever" },
  { name: "אשמורת",    nameEn: "Ashmoret" },
  { name: "פייס פלוס", nameEn: "Pais Plus" },
  { name: "נופשית",    nameEn: "Nofeshit" },
  { name: "מקס",       nameEn: "Max" },
  { name: "ישראכרט",   nameEn: "Isracard" },
  { name: "KSP",       nameEn: "KSP" },
  { name: "Bug",       nameEn: "Bug" },
] as const;

export async function GET() {
  try {
    await Promise.all(
      SUPPORTED_NETWORKS.map((n) =>
        prisma.giftCardNetwork.upsert({
          where:  { name: n.name },
          update: {},
          create: { name: n.name, nameEn: n.nameEn, isActive: true },
        })
      )
    );

    const networks = await prisma.giftCardNetwork.findMany({
      where:   { name: { in: SUPPORTED_NETWORKS.map((n) => n.name) }, isActive: true },
      orderBy: { name: "asc" },
      select:  { id: true, name: true, logoUrl: true },
    });

    return NextResponse.json(networks);
  } catch (err) {
    console.error("[wallet/networks GET]", err);
    return NextResponse.json({ message: "שגיאת שרת" }, { status: 500 });
  }
}
