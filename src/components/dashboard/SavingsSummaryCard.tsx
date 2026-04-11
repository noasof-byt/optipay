"use client";

import { useEffect, useState } from "react";
import { TrendingDown, ChevronLeft } from "lucide-react";
import Link from "next/link";
import { Card, CardBody } from "@/components/ui/Card";
import { formatILS } from "@/lib/utils";
import { getToken } from "@/hooks/useAuth";

interface SavingsData {
  monthly:  number;
  yearly:   number;
  allTime:  number;
}

// Shown when not logged in or when the API fails
const MOCK: SavingsData = { monthly: 0, yearly: 0, allTime: 0 };

// Skeleton line
function SkeletonLine({ wide }: { wide?: boolean }) {
  return (
    <div className={`h-4 rounded-full bg-surface-border animate-pulse ${wide ? "w-24" : "w-16"}`} />
  );
}

export function SavingsSummaryCard() {
  const [data,    setData]    = useState<SavingsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (!token) { setData(MOCK); setLoading(false); return; }

    fetch("/api/dashboard", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((json) => {
        if (json?.savings) {
          setData({
            monthly: json.savings.monthly  ?? 0,
            yearly:  json.savings.yearly   ?? 0,
            allTime: json.savings.allTime  ?? 0,
          });
        } else {
          setData(MOCK);
        }
      })
      .catch((err) => {
        console.error("[SavingsSummaryCard] fetch failed, using mock:", err);
        setData(MOCK);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <Card accent="accent">
      <CardBody className="pt-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="flex items-center justify-center w-9 h-9 rounded-2xl bg-accent-100">
              <TrendingDown size={18} className="text-accent-600" />
            </span>
            <span className="text-sm font-semibold text-ink">חסכת החודש</span>
          </div>
          <Link
            href="/dashboard"
            className="flex items-center gap-0.5 text-xs text-sky-500 font-medium hover:underline"
          >
            הכל
            <ChevronLeft size={14} />
          </Link>
        </div>

        {/* Main figure */}
        {loading ? (
          <div className="mb-1"><SkeletonLine wide /></div>
        ) : (
          <p className="text-3xl font-extrabold text-savings mb-1">
            {formatILS(data?.monthly ?? 0, 0)}
          </p>
        )}
        <p className="text-xs text-ink-muted mb-4">לעומת המחיר המלא</p>

        {/* Secondary stats */}
        <div className="flex gap-4 pt-3 border-t border-surface-border">
          {loading ? (
            <>
              <SkeletonLine />
              <div className="w-px bg-surface-border" />
              <SkeletonLine />
            </>
          ) : (
            <>
              <Stat label="השנה" value={formatILS(data?.yearly  ?? 0, 0)} />
              <div className="w-px bg-surface-border" />
              <Stat label='סה"כ' value={formatILS(data?.allTime ?? 0, 0)} />
            </>
          )}
        </div>
      </CardBody>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex-1">
      <p className="text-xs text-ink-muted mb-0.5">{label}</p>
      <p className="text-base font-bold text-ink">{value}</p>
    </div>
  );
}
