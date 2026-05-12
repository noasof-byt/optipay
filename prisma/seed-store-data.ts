/**
 * Seed store_networks and store_club_benefits tables.
 *
 * Run with:
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seed-store-data.ts
 *
 * Uses upsert throughout — safe to run multiple times.
 */

import { PrismaClient } from "@prisma/client";

// Seeds must bypass the PgBouncer pooler — use DIRECT_URL (port 5432) when available
const prisma = new PrismaClient({
  log: ["warn", "error"],
  datasources: { db: { url: process.env.DIRECT_URL ?? process.env.DATABASE_URL } },
});

// ── Scraper store names (must match what scrapers emit as storeName) ──────────
const SCRAPER_STORE_NAMES = [
  "Bug", "ZAP", "KSP", "מחסני החשמל",
  // SerpApi-discovered stores
  "א.ל.מ", "שקם אלקטריק", "אבי סופר", "Last Price", "Ivory", "TMS",
];

// ── Clubs to seed with their discount rules ───────────────────────────────────
const CLUBS_TO_SEED = [
  { name: "חבר",          nameEn: "Chevre",        discountPct: 10, noDouble: false, paid: false },
  { name: "ארגון המורים", nameEn: "Teachers Org",  discountPct:  8, noDouble: false, paid: false },
  { name: "לאומי קארד",  nameEn: "Leumi Card",     discountPct:  5, noDouble: true,  paid: false },
  { name: "הסתדרות",     nameEn: "Histadrut",      discountPct:  7, noDouble: false, paid: false },
  { name: "מועדון עובדים", nameEn: "Workers Club", discountPct:  8, noDouble: false, paid: false },
];

async function main() {
  console.log("=== OptiPay Store Data Seed ===\n");

  // ── 1. Upsert stores ───────────────────────────────────────────────────────
  const storeMap = new Map<string, string>(); // name → id

  for (const name of SCRAPER_STORE_NAMES) {
    const s = await prisma.store.upsert({
      where:  { name },
      update: { isActive: true },
      create: { name, isActive: true, isOnline: true },
      select: { id: true, name: true },
    });
    storeMap.set(s.name, s.id);
    console.log(`[Store] ${s.name} → ${s.id}`);
  }

  // ── 2. Read all active gift card networks ──────────────────────────────────
  const networks = await prisma.giftCardNetwork.findMany({
    where:  { isActive: true },
    select: { id: true, name: true },
  });
  console.log(`\n[Networks] Found ${networks.length}: ${networks.map((n) => n.name).join(", ") || "(none)"}`);

  if (!networks.length) {
    console.log("  ⚠  No gift_card_networks in DB yet. Creating a default BuyMe network...");
    const buyMe = await prisma.giftCardNetwork.create({
      data:   { name: "BuyMe", nameEn: "BuyMe", isActive: true },
      select: { id: true, name: true },
    });
    networks.push(buyMe);
    console.log(`  Created: BuyMe → ${buyMe.id}`);
  }

  // ── 3. Link every store ↔ every network ───────────────────────────────────
  console.log("\n--- StoreNetworks ---");
  let snCount = 0;
  for (const [storeName, storeId] of storeMap) {
    for (const network of networks) {
      await prisma.storeNetwork.upsert({
        where:  { storeId_networkId: { storeId, networkId: network.id } },
        update: { isActive: true },
        create: { storeId, networkId: network.id, isActive: true },
      });
      console.log(`  ✓ ${storeName} ↔ ${network.name}`);
      snCount++;
    }
  }
  console.log(`StoreNetworks upserted: ${snCount}`);

  // ── 4. Upsert clubs ────────────────────────────────────────────────────────
  console.log("\n--- Clubs ---");
  const clubMap = new Map<string, string>(); // name → id

  for (const c of CLUBS_TO_SEED) {
    const club = await prisma.club.upsert({
      where:  { name: c.name },
      update: { isActive: true },
      create: {
        name:                  c.name,
        nameEn:                c.nameEn,
        aliases:               "[]",
        baseDiscountPercentage: c.discountPct,
        isPaidMembership:      c.paid,
        isActive:              true,
      },
      select: { id: true, name: true },
    });
    clubMap.set(club.name, club.id);
    console.log(`  [Club] ${club.name} → ${club.id}`);
  }

  // ── 5. Also include any other active clubs already in DB ──────────────────
  const existingClubs = await prisma.club.findMany({
    where:  { isActive: true },
    select: { id: true, name: true, baseDiscountPercentage: true },
  });
  for (const ec of existingClubs) {
    if (!clubMap.has(ec.name)) clubMap.set(ec.name, ec.id);
  }

  // ── 6. Link every store ↔ every club ─────────────────────────────────────
  console.log("\n--- StoreClubBenefits ---");
  let scbCount = 0;

  for (const [storeName, storeId] of storeMap) {
    for (const c of CLUBS_TO_SEED) {
      const clubId = clubMap.get(c.name);
      if (!clubId) continue;
      await prisma.storeClubBenefit.upsert({
        where:  { storeId_clubId: { storeId, clubId } },
        update: { isActive: true, noDoubleDiscount: c.noDouble },
        create: {
          storeId,
          clubId,
          discountPercentage: c.discountPct,
          noDoubleDiscount:   c.noDouble,
          isActive:           true,
        },
      });
      console.log(`  ✓ ${storeName} ↔ ${c.name} → ${c.discountPct}%${c.noDouble ? " (no double)" : ""}`);
      scbCount++;
    }

    // Fill remaining clubs from DB with their base discount
    for (const ec of existingClubs) {
      if (CLUBS_TO_SEED.some((s) => s.name === ec.name)) continue; // already handled
      const clubId = ec.id;
      const pct    = Number(ec.baseDiscountPercentage) || 5;
      await prisma.storeClubBenefit.upsert({
        where:  { storeId_clubId: { storeId, clubId } },
        update: { isActive: true },
        create: {
          storeId,
          clubId,
          discountPercentage: pct,
          noDoubleDiscount:   false,
          isActive:           true,
        },
      });
      console.log(`  ✓ ${storeName} ↔ ${ec.name} → ${pct}% (from DB)`);
      scbCount++;
    }
  }
  console.log(`StoreClubBenefits upserted: ${scbCount}`);

  // ── 7. Summary ─────────────────────────────────────────────────────────────
  const [totalSN, totalSCB] = await Promise.all([
    prisma.storeNetwork.count(),
    prisma.storeClubBenefit.count(),
  ]);
  console.log(`\n=== Done ===`);
  console.log(`Total store_networks rows:      ${totalSN}`);
  console.log(`Total store_club_benefits rows: ${totalSCB}`);
  console.log(`\nExpected matchmaker logs after seeding:`);
  console.log(`  [MATCHMAKER] Card X matches store Y → discount ₪N`);
  console.log(`  [MATCHMAKER] Club X matches store Y → N% discount`);
}

main()
  .catch((err) => { console.error(err); process.exit(1); })
  .finally(() => prisma.$disconnect());
