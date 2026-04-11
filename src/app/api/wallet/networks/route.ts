/** GET /api/wallet/networks — list gift card networks for the Add Card form */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const networks = await prisma.giftCardNetwork.findMany({
    where:   { isActive: true },
    orderBy: { name: "asc" },
    select:  { id: true, name: true, logoUrl: true },
  });
  return NextResponse.json(networks);
}
