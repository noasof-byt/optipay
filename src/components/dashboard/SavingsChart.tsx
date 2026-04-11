"use client";

import { formatILS } from "@/lib/utils";

interface MonthData {
  month: string;   // "2025-12"
  total: number;
  count: number;
}

interface Props {
  data: MonthData[];
}

export function SavingsChart({ data }: Props) {
  if (!data.length) {
    return (
      <div className="flex items-end justify-center h-32 text-ink-faint text-sm">
        אין נתוני חיסכון עדיין
      </div>
    );
  }

  const max = Math.max(...data.map((d) => d.total), 1);

  const monthLabel = (iso: string) => {
    const [y, m] = iso.split("-");
    return new Date(Number(y), Number(m) - 1, 1)
      .toLocaleDateString("he-IL", { month: "short" });
  };

  return (
    <div className="flex items-end gap-1.5 h-36 pt-2" role="img" aria-label="גרף חיסכון חודשי">
      {data.map((d) => {
        const pct = (d.total / max) * 100;
        return (
          <div key={d.month} className="flex-1 flex flex-col items-center gap-1 min-w-0">
            {/* Tooltip on tap / hover */}
            <div className="group relative flex-1 w-full flex items-end">
              <div
                className="w-full rounded-t-xl bg-brand-400 group-hover:bg-accent-500 transition-colors relative"
                style={{ height: `${Math.max(pct, 4)}%` }}
              >
                {/* Value label — shows on hover */}
                <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-[0.55rem] font-bold text-ink whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none bg-white rounded-lg px-1 shadow-sm">
                  {formatILS(d.total, 0)}
                </span>
              </div>
            </div>
            <span className="text-[0.55rem] text-ink-faint truncate w-full text-center">
              {monthLabel(d.month)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
