/**
 * OptiPay — Prisma Seed
 * Seeds baseline system-managed data:
 *   - Known Israeli consumer clubs
 *   - Known gift card networks
 *   - Club ↔ Network "no double dipping" rules
 *   - Default scraping configs per club
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // ── 1. Gift Card Networks ──────────────────────────────────────────────────
  const buyme = await prisma.giftCardNetwork.upsert({
    where: { name: "BuyMe" },
    update: {},
    create: {
      name: "BuyMe",
      nameEn: "BuyMe",
      websiteUrl: "https://www.buyme.co.il",
      isActive: true,
    },
  });

  const giftCard = await prisma.giftCardNetwork.upsert({
    where: { name: "Giftcard" },
    update: {},
    create: {
      name: "Giftcard",
      nameEn: "Giftcard.co.il",
      websiteUrl: "https://www.giftcard.co.il",
      isActive: true,
    },
  });

  const one1 = await prisma.giftCardNetwork.upsert({
    where: { name: "One1 Gift" },
    update: {},
    create: {
      name: "One1 Gift",
      nameEn: "One1",
      isActive: true,
    },
  });

  // ── 2. Consumer Clubs ──────────────────────────────────────────────────────
  const hever = await prisma.club.upsert({
    where: { name: "הטבות חבר" },
    update: {},
    create: {
      name: "הטבות חבר",
      nameEn: "Hever",
      aliases: JSON.stringify(["hever", "חבר", "הטבות חבר"]),
      description: "מועדון הטבות לעובדי מדינה",
      websiteUrl: "https://www.hever.co.il",
      baseDiscountPercentage: 10,
      isPaidMembership: false,
      isActive: true,
    },
  });

  const teachers = await prisma.club.upsert({
    where: { name: "ארגון המורים" },
    update: {},
    create: {
      name: "ארגון המורים",
      nameEn: "Teachers Union",
      aliases: JSON.stringify(["teachers", "מורים", "ארגון המורים"]),
      description: "הטבות לחברי ארגון המורים",
      baseDiscountPercentage: 8,
      isPaidMembership: true,
      isActive: true,
    },
  });

  const leumi = await prisma.club.upsert({
    where: { name: "לאומי קארד" },
    update: {},
    create: {
      name: "לאומי קארד",
      nameEn: "Leumi Card",
      aliases: JSON.stringify(["leumi", "לאומי", "max"]),
      description: "הטבות לבעלי כרטיס לאומי קארד / מקס",
      baseDiscountPercentage: 5,
      isPaidMembership: false,
      isActive: true,
    },
  });

  // ── 3. No-Double-Dipping Rules ─────────────────────────────────────────────
  // Hever + BuyMe: cannot be combined in most stores
  await prisma.clubNetworkRule.upsert({
    where: { clubId_networkId: { clubId: hever.id, networkId: buyme.id } },
    update: {},
    create: {
      clubId: hever.id,
      networkId: buyme.id,
      canCombine: false,
      ruleDescription:
        "אין לשלב בין כרטיסי BuyMe לבין הנחת מועדון חבר — יש לבחור מסלול אחד",
    },
  });

  // Teachers + Giftcard: allowed to combine
  await prisma.clubNetworkRule.upsert({
    where: {
      clubId_networkId: { clubId: teachers.id, networkId: giftCard.id },
    },
    update: {},
    create: {
      clubId: teachers.id,
      networkId: giftCard.id,
      canCombine: true,
      ruleDescription: "ניתן לשלב כרטיס מתנה Giftcard עם הנחת ארגון המורים",
    },
  });

  // ── 4. Scraping Configs ────────────────────────────────────────────────────
  await prisma.clubScrapingConfig.create({
    data: {
      clubId: hever.id,
      targetUrl: "https://www.hever.co.il/benefits",
      scrapeStrategy: "playwright",
      selectorConfig: JSON.stringify({
        storeName: ".benefit-card .store-name",
        discountText: ".benefit-card .discount-value",
        restrictionText: ".benefit-card .terms",
        paginationNext: ".pagination .next",
      }),
      isActive: true,
    },
  });

  await prisma.clubScrapingConfig.create({
    data: {
      clubId: teachers.id,
      targetUrl: "https://www.morim.org.il/benefits",
      scrapeStrategy: "cheerio",
      selectorConfig: JSON.stringify({
        storeName: "table.benefits-table td.store",
        discountText: "table.benefits-table td.discount",
        restrictionText: "table.benefits-table td.terms",
      }),
      isActive: true,
    },
  });

  console.log("✅  Seed complete — clubs, networks, and rules inserted.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
