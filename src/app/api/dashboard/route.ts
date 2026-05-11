/**
 * GET /api/dashboard
 * Returns aggregated savings data for the dashboard.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAuth, getUserId }    from "@/server/auth/middleware";
import { prisma }                    from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const authError = await requireAuth(req);
  if (authError) return authError;
  const userId = getUserId(req);

  const now        = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const yearStart  = new Date(now.getFullYear(), 0, 1);
  const sixMonthsAgo = new Date(now);
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const [monthlySavings, yearlySavings, allTimeSavings, recentRecords, clubUsage, recentHistory] =
    await Promise.all([
      // Monthly total
      prisma.savingsRecord.aggregate({
        where:   { userId, purchasedAt: { gte: monthStart } },
        _sum:    { savedAmount: true },
        _count:  { id: true },
      }),
      // Yearly total
      prisma.savingsRecord.aggregate({
        where:   { userId, purchasedAt: { gte: yearStart } },
        _sum:    { savedAmount: true },
        _count:  { id: true },
      }),
      // All-time
      prisma.savingsRecord.aggregate({
        where:  { userId },
        _sum:   { savedAmount: true },
        _count: { id: true },
      }),
      // Last 12 months grouped by month — PostgreSQL syntax
      prisma.$queryRaw<Array<{ month: string; total: number; count: bigint }>>`
        SELECT
          TO_CHAR("purchasedAt", 'YYYY-MM')    AS month,
          CAST(SUM("savedAmount") AS FLOAT)    AS total,
          COUNT(*)                             AS count
        FROM savings_records
        WHERE "userId" = ${userId}
          AND "purchasedAt" >= NOW() - INTERVAL '12 months'
        GROUP BY TO_CHAR("purchasedAt", 'YYYY-MM')
        ORDER BY month ASC
      `,
      // Club usage with monthlyFee for ROI
      prisma.userClubMembership.findMany({
        where:   { userId, isActive: true },
        include: { club: { select: { name: true } } },
        orderBy: { lastUsedAt: "desc" },
      }),
      // Last 10 SearchHistory entries (purchases only — have savingsAmount)
      prisma.searchHistory.findMany({
        where:   { userId, savingsAmount: { not: null } },
        orderBy: { createdAt: "desc" },
        take:    10,
        select: {
          id: true, query: true, productName: true, storeName: true,
          originalPrice: true, finalPrice: true, savingsAmount: true,
          benefitUsed: true, createdAt: true,
        },
      }),
    ]);

  // ── ROI per paid membership ─────────────────────────────────────────────
  // Sum savings this month per membership
  const paidMemberships = clubUsage.filter((m) => m.isPaidMembership && Number(m.monthlyFee) > 0);

  const membershipSavingsThisMonth = paidMemberships.length
    ? await Promise.all(
        paidMemberships.map((m) =>
          prisma.searchHistory.aggregate({
            where: {
              userId,
              membershipId: m.id,
              createdAt:    { gte: monthStart },
              savingsAmount: { not: null },
            },
            _sum: { savingsAmount: true },
          }).then((agg) => ({
            membershipId: m.id,
            savings: Number(agg._sum.savingsAmount ?? 0),
          }))
        )
      )
    : [];

  const savingsMap = Object.fromEntries(
    membershipSavingsThisMonth.map((e) => [e.membershipId, e.savings])
  );

  const paidMembershipRoi = clubUsage
    .filter((m) => m.isPaidMembership && Number(m.monthlyFee) > 0)
    .map((m) => {
      const fee       = Number(m.monthlyFee);
      const savings   = savingsMap[m.id] ?? 0;
      const roi       = savings - fee;
      const isUnused  = !m.lastUsedAt || m.lastUsedAt < sixMonthsAgo;
      return {
        id:        m.id,
        clubName:  m.club.name,
        monthlyFee: fee,
        savingsThisMonth: savings,
        roi,
        isUnused,
      };
    });

  return NextResponse.json({
    savings: {
      monthly:  Number(monthlySavings._sum.savedAmount ?? 0),
      yearly:   Number(yearlySavings._sum.savedAmount  ?? 0),
      allTime:  Number(allTimeSavings._sum.savedAmount  ?? 0),
      monthlyTransactions: monthlySavings._count.id,
      yearlyTransactions:  yearlySavings._count.id,
    },
    monthlyChart: recentRecords.map((r) => ({
      month: r.month,
      total: r.total,
      count: Number(r.count),
    })),
    clubUsage: clubUsage.map((m) => ({
      clubName:   m.club.name,
      lastUsedAt: m.lastUsedAt,
    })),
    paidMembershipRoi,
    recentHistory: recentHistory.map((h) => ({
      id:            h.id,
      query:         h.query,
      productName:   h.productName,
      storeName:     h.storeName,
      originalPrice: h.originalPrice ? Number(h.originalPrice) : null,
      finalPrice:    h.finalPrice    ? Number(h.finalPrice)    : null,
      savingsAmount: h.savingsAmount ? Number(h.savingsAmount) : null,
      benefitUsed:   h.benefitUsed,
      createdAt:     h.createdAt,
    })),
  });
}
