"use client";

import { useEffect, useState } from "react";
import { TrendingDown, ShoppingBag, Calendar, BadgeCheck, AlertTriangle, Clock } from "lucide-react";
import { SavingsChart }  from "@/components/dashboard/SavingsChart";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { formatILS, formatDateHe } from "@/lib/utils";
import { getToken } from "@/hooks/useAuth";

interface MembershipRoi {
  id:               string;
  clubName:         string;
  monthlyFee:       number;
  savingsThisMonth: number;
  roi:              number;
  isUnused:         boolean;
}

interface HistoryEntry {
  id:            string;
  query:         string;
  productName:   string | null;
  storeName:     string | null;
  originalPrice: number | null;
  finalPrice:    number | null;
  savingsAmount: number | null;
  benefitUsed:   string | null;
  createdAt:     string;
}

interface DashboardData {
  savings: {
    monthly:  number;
    yearly:   number;
    allTime:  number;
    monthlyTransactions: number;
    yearlyTransactions:  number;
  };
  monthlyChart: Array<{ month: string; total: number; count: number }>;
  clubUsage:    Array<{ clubName: string; lastUsedAt: string | null }>;
  paidMembershipRoi: MembershipRoi[];
  recentHistory:     HistoryEntry[];
}

export default function DashboardPage() {
  const [data,    setData]    = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (!token) { setLoading(false); return; }

    fetch("/api/dashboard", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (r) => {
        if (!r.ok) return;
        const json = await r.json();
        if (json?.savings) setData(json);
      })
      .catch((err) => console.error("[Dashboard] fetch error:", err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="page-container py-4 space-y-4 animate-pulse">
        {[1, 2, 3].map((i) => <div key={i} className="card h-32 bg-surface-muted" />)}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="page-container py-16 flex flex-col items-center text-center gap-4">
        <span className="text-5xl">📊</span>
        <h2 className="text-lg font-bold text-ink">עדיין לא חסכת כלום?</h2>
        <p className="text-sm text-ink-muted">חפש מוצר, בחר מסלול קנייה ולחץ ״השתמשתי בנתיב הזה״ — החיסכון יופיע כאן</p>
      </div>
    );
  }

  const s = data.savings;
  const unusedPaid = data.paidMembershipRoi.filter((m) => m.isUnused);

  return (
    <div className="page-container py-4 space-y-5">
      <h1 className="text-lg font-bold text-ink">החיסכון שלי</h1>

      {/* ── 6-month unused paid memberships alert ── */}
      {unusedPaid.length > 0 && (
        <div className="flex items-start gap-2 bg-warning-50 border border-warning-200 rounded-2xl p-3">
          <AlertTriangle size={16} className="text-warning-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-warning-700">
              {unusedPaid.length === 1
                ? `לא השתמשת ב${unusedPaid[0].clubName} יותר מ-6 חודשים`
                : `${unusedPaid.length} מועדונים בתשלום לא נוצלו מזה 6 חודשים`}
            </p>
            <p className="text-[0.65rem] text-warning-600 mt-0.5">
              שקול האם כדאי להמשיך את החברות
            </p>
          </div>
        </div>
      )}

      {/* ── Stat grid ── */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          icon={<TrendingDown size={18} className="text-accent-600" />}
          label="החודש"
          value={formatILS(s.monthly, 0)}
          sub={`${s.monthlyTransactions} קניות`}
          accent
        />
        <StatCard
          icon={<Calendar size={18} className="text-brand-600" />}
          label="השנה"
          value={formatILS(s.yearly, 0)}
          sub={`${s.yearlyTransactions} קניות`}
        />
        <StatCard
          icon={<ShoppingBag size={18} className="text-brand-600" />}
          label="סה״כ"
          value={formatILS(s.allTime, 0)}
          sub="מתחילת הדרך"
          colSpan
        />
      </div>

      {/* ── Monthly chart ── */}
      <Card>
        <CardHeader>
          <CardTitle>חיסכון חודשי — 12 חודשים אחרונים</CardTitle>
        </CardHeader>
        <CardBody>
          <SavingsChart data={data.monthlyChart} />
        </CardBody>
      </Card>

      {/* ── Paid membership ROI ── */}
      {data.paidMembershipRoi.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>ROI מועדונים בתשלום</CardTitle>
          </CardHeader>
          <CardBody className="space-y-3">
            {data.paidMembershipRoi.map((m) => {
              const positive = m.roi >= 0;
              return (
                <div key={m.id} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <BadgeCheck size={15} className="text-brand-500 shrink-0" />
                      <span className="text-sm text-ink font-medium">{m.clubName}</span>
                      {m.isUnused && (
                        <span className="text-[0.6rem] font-bold px-1.5 py-0.5 rounded-full bg-warning-100 text-warning-700">
                          לא בשימוש
                        </span>
                      )}
                    </div>
                    <span className={`text-sm font-bold ${positive ? "text-accent-600" : "text-danger"}`}>
                      {positive ? "+" : ""}{formatILS(m.roi, 0)}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs text-ink-muted px-5">
                    <span>דמי חברות: {formatILS(m.monthlyFee, 0)}</span>
                    <span>חיסכון החודש: {formatILS(m.savingsThisMonth, 0)}</span>
                  </div>
                  {/* ROI bar */}
                  <div className="h-1.5 rounded-full bg-surface-muted overflow-hidden mx-5">
                    <div
                      className={`h-full rounded-full transition-all ${positive ? "bg-accent-400" : "bg-danger"}`}
                      style={{ width: `${Math.min(100, m.monthlyFee > 0 ? (m.savingsThisMonth / m.monthlyFee) * 100 : 0)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </CardBody>
        </Card>
      )}

      {/* ── Club usage ── */}
      {data.clubUsage.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>שימוש במועדונים</CardTitle>
          </CardHeader>
          <CardBody className="space-y-3">
            {data.clubUsage.map((c) => (
              <div key={c.clubName} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BadgeCheck size={16} className="text-accent-500 shrink-0" />
                  <span className="text-sm text-ink">{c.clubName}</span>
                </div>
                <span className="text-xs text-ink-muted">
                  {c.lastUsedAt
                    ? formatDateHe(c.lastUsedAt, { day: "2-digit", month: "short" })
                    : "לא נוצל"}
                </span>
              </div>
            ))}
          </CardBody>
        </Card>
      )}

      {/* ── Recent purchase history ── */}
      {data.recentHistory.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>רכישות אחרונות</CardTitle>
          </CardHeader>
          <CardBody className="space-y-3">
            {data.recentHistory.map((h) => (
              <div key={h.id} className="flex items-start gap-3 pb-3 border-b border-surface-border last:border-0 last:pb-0">
                <div className="w-8 h-8 rounded-xl bg-brand-50 flex items-center justify-center shrink-0 mt-0.5">
                  <Clock size={14} className="text-brand-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-ink truncate">
                    {h.productName ?? h.query}
                  </p>
                  <p className="text-xs text-ink-muted">
                    {h.storeName && `${h.storeName} · `}
                    {h.benefitUsed && `${h.benefitUsed} · `}
                    {formatDateHe(h.createdAt, { day: "2-digit", month: "short" })}
                  </p>
                </div>
                {h.savingsAmount !== null && h.savingsAmount > 0 && (
                  <span className="text-sm font-bold text-accent-600 shrink-0">
                    -{formatILS(h.savingsAmount, 0)}
                  </span>
                )}
              </div>
            ))}
          </CardBody>
        </Card>
      )}
    </div>
  );
}

function StatCard({
  icon, label, value, sub, accent, colSpan,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
  colSpan?: boolean;
}) {
  return (
    <div className={`card p-4 ${colSpan ? "col-span-2" : ""}`}>
      <div className="flex items-center gap-2 mb-2">
        <span className={`w-8 h-8 rounded-xl flex items-center justify-center ${accent ? "bg-accent-100" : "bg-brand-100"}`}>
          {icon}
        </span>
        <span className="text-xs text-ink-muted font-medium">{label}</span>
      </div>
      <p className={`text-2xl font-extrabold leading-tight ${accent ? "text-accent-600" : "text-ink"}`}>
        {value}
      </p>
      {sub && <p className="text-xs text-ink-faint mt-0.5">{sub}</p>}
    </div>
  );
}
