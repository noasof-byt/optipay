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

  const [monthlySavings, yearlySavings, allTimeSavings, recentRecords, clubUsage] =
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
      // Last 12 months grouped by month — T-SQL syntax for SQL Server
      prisma.$queryRaw<Array<{ month: string; total: number; count: number }>>`
        SELECT
          FORMAT(purchasedAt, 'yyyy-MM')   AS month,
          CAST(SUM(savedAmount) AS FLOAT)  AS total,
          COUNT(*)                         AS count
        FROM savings_records
        WHERE userId = ${userId}
          AND purchasedAt >= DATEADD(MONTH, -12, GETDATE())
        GROUP BY FORMAT(purchasedAt, 'yyyy-MM')
        ORDER BY month ASC
      `,
      // Club usage frequency (from UserClubMembership lastUsedAt)
      prisma.userClubMembership.findMany({
        where:   { userId, isActive: true },
        include: { club: { select: { name: true } } },
        orderBy: { lastUsedAt: "desc" },
        take:    5,
      }),
    ]);

  return NextResponse.json({
    savings: {
      monthly:  Number(monthlySavings._sum.savedAmount ?? 0),
      yearly:   Number(yearlySavings._sum.savedAmount  ?? 0),
      allTime:  Number(allTimeSavings._sum.savedAmount  ?? 0),
      monthlyTransactions: monthlySavings._count.id,
      yearlyTransactions:  yearlySavings._count.id,
    },
    monthlyChart: recentRecords,
    clubUsage: clubUsage.map((m) => ({
      clubName:  m.club.name,
      lastUsedAt: m.lastUsedAt,
    })),
  });
}
