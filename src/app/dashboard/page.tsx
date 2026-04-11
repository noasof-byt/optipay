"use client";

import { useEffect, useState } from "react";
import { TrendingDown, ShoppingBag, BadgeCheck, Calendar } from "lucide-react";
import { SavingsChart }  from "@/components/dashboard/SavingsChart";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { formatILS, formatDateHe } from "@/lib/utils";
import { getToken } from "@/hooks/useAuth";

interface DashboardData {
  savings: {
    monthly:  number;
    yearly:   number;
    allTime:  number;
    monthlyTransactions: number;
    yearlyTransactions:  number;
  };
  monthlyChart: Array<{ month: string; total: number; count: number }>;
  clubUsage: Array<{ clubName: string; lastUsedAt: string | null }>;
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
        if (!r.ok) return; // 401 / 403 — stay on null data
        const json = await r.json();
        // Guard: only accept if shape is correct
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
        <p className="text-sm text-ink-muted">חפש מוצר, בחר מסלול קנייה ולחץ ״קניתי כאן״ — החיסכון יופיע כאן</p>
      </div>
    );
  }

  const s = data?.savings;

  return (
    <div className="page-container py-4 space-y-5">
      <h1 className="text-lg font-bold text-ink">החיסכון שלי</h1>

      {/* ── Stat grid ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          icon={<TrendingDown size={18} className="text-accent-600" />}
          label="החודש"
          value={formatILS(s?.monthly ?? 0, 0)}
          sub={`${s?.monthlyTransactions ?? 0} קניות`}
          accent
        />
        <StatCard
          icon={<Calendar size={18} className="text-brand-600" />}
          label="השנה"
          value={formatILS(s?.yearly ?? 0, 0)}
          sub={`${s?.yearlyTransactions ?? 0} קניות`}
        />
        <StatCard
          icon={<ShoppingBag size={18} className="text-brand-600" />}
          label="סה״כ"
          value={formatILS(s?.allTime ?? 0, 0)}
          sub="מתחילת הדרך"
          colSpan
        />
      </div>

      {/* ── Monthly chart ──────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>חיסכון חודשי — 12 חודשים אחרונים</CardTitle>
        </CardHeader>
        <CardBody>
          <SavingsChart data={data?.monthlyChart ?? []} />
        </CardBody>
      </Card>

      {/* ── Club usage ─────────────────────────────────────────────────── */}
      {(data?.clubUsage?.length ?? 0) > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>שימוש במועדונים</CardTitle>
          </CardHeader>
          <CardBody className="space-y-3">
            {data!.clubUsage.map((c) => (
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
