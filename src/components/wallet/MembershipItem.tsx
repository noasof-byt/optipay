"use client";

import { Trash2, BadgeCheck, AlertTriangle } from "lucide-react";
import { cn, formatDateHe } from "@/lib/utils";
import { MembershipItem as MType } from "@/hooks/useWallet";

interface Props {
  membership:  MType;
  onRemove:    (id: string) => void;
}

export function MembershipItemCard({ membership, onRemove }: Props) {
  const sixMonthsAgo = new Date(Date.now() - 6 * 30 * 24 * 60 * 60 * 1000);
  const unused = !membership.lastUsedAt ||
    new Date(membership.lastUsedAt) < sixMonthsAgo;

  // Expiry warning: show when ≤30 days left (and not already expired)
  const expiryWarningDays = membership.expiryDate
    ? (() => {
        const daysLeft = Math.ceil(
          (new Date(membership.expiryDate!).getTime() - Date.now()) / 86_400_000
        );
        return daysLeft > 0 && daysLeft <= 30 ? daysLeft : null;
      })()
    : null;

  return (
    <div className={cn(
      "card flex items-start justify-between gap-3 p-4",
      unused && membership.isPaidMembership && "ring-1 ring-warning",
      expiryWarningDays !== null && "ring-1 ring-danger"
    )}>
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <span className="w-10 h-10 rounded-2xl bg-accent-100 flex items-center justify-center shrink-0">
          <BadgeCheck size={20} className="text-accent-600" />
        </span>

        <div className="min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="text-sm font-bold text-ink">{membership.clubName}</p>
            {membership.isPaidMembership && (
              <span className="badge bg-brand-100 text-brand-700 text-[0.6rem]">בתשלום</span>
            )}
          </div>

          <p className="text-xs text-ink-muted mt-0.5">
            הנחה בסיסית: {membership.baseDiscount}%
          </p>

          {membership.lastUsedAt ? (
            <p className="text-[0.65rem] text-ink-faint mt-0.5">
              שימוש אחרון:{" "}
              {formatDateHe(membership.lastUsedAt, { day: "2-digit", month: "short", year: "numeric" })}
            </p>
          ) : (
            <p className="text-[0.65rem] text-ink-faint mt-0.5">טרם נוצל</p>
          )}

          {membership.isPaidMembership && unused && (
            <div className="flex items-center gap-1 mt-1.5">
              <AlertTriangle size={11} className="text-warning shrink-0" />
              <p className="text-[0.6rem] text-warning font-semibold">
                לא בשימוש 6+ חודשים — האם עדיין כדאי?
              </p>
            </div>
          )}

          {expiryWarningDays !== null && (
            <div className="flex items-center gap-1 mt-1.5">
              <AlertTriangle size={11} className="text-danger shrink-0" />
              <p className="text-[0.6rem] text-danger font-semibold">
                החברות פוקעת בעוד {expiryWarningDays} ימים — {membership.isPaidMembership ? "חדש או בטל" : "בדוק חידוש"}
              </p>
            </div>
          )}

          {membership.expiryDate && !expiryWarningDays && (
            <p className="text-[0.65rem] text-ink-faint mt-0.5">
              תוקף:{" "}
              {formatDateHe(membership.expiryDate, { day: "2-digit", month: "short", year: "numeric" })}
            </p>
          )}
        </div>
      </div>

      <button
        onClick={() => onRemove(membership.id)}
        className="p-1.5 rounded-xl text-ink-faint hover:text-danger transition-colors shrink-0 mt-0.5"
        aria-label={`הסר חברות ל${membership.clubName}`}
      >
        <Trash2 size={16} />
      </button>
    </div>
  );
}
