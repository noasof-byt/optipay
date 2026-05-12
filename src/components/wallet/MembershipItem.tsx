"use client";

import { useState } from "react";
import { Trash2, BadgeCheck, AlertTriangle, Users } from "lucide-react";
import { cn, formatDateHe } from "@/lib/utils";
import { MembershipItem as MType } from "@/hooks/useWallet";

interface Props {
  membership:        MType;
  onRemove:          (id: string) => void;
  onShareToggle?:    (id: string, v: boolean) => void;
  isInFamilyGroup?:  boolean;
}

export function MembershipItemCard({ membership, onRemove, onShareToggle, isInFamilyGroup }: Props) {
  const [toggling, setToggling] = useState(false);

  const sixMonthsAgo = new Date(Date.now() - 6 * 30 * 24 * 60 * 60 * 1000);
  const unused = !membership.lastUsedAt ||
    new Date(membership.lastUsedAt) < sixMonthsAgo;

  const expiryWarningDays = membership.expiryDate
    ? (() => {
        const daysLeft = Math.ceil(
          (new Date(membership.expiryDate!).getTime() - Date.now()) / 86_400_000
        );
        return daysLeft > 0 && daysLeft <= 30 ? daysLeft : null;
      })()
    : null;

  async function handleShareToggle() {
    if (!onShareToggle || toggling) return;
    setToggling(true);
    try {
      await onShareToggle(membership.id, !membership.isSharedWithFamily);
    } finally {
      setToggling(false);
    }
  }

  return (
    <div className={cn(
      "card flex flex-col gap-0 p-4",
      unused && membership.isPaidMembership && !membership.isShared && "ring-1 ring-warning",
      expiryWarningDays !== null && "ring-1 ring-danger"
    )}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <span className="w-10 h-10 rounded-2xl bg-accent-100 flex items-center justify-center shrink-0">
            <BadgeCheck size={20} className="text-accent-600" />
          </span>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <p className="text-sm font-bold text-ink">{membership.clubName}</p>
              {membership.isPaidMembership && !membership.isShared && (
                <span className="badge bg-brand-100 text-brand-700 text-[0.6rem]">בתשלום</span>
              )}
              {membership.isShared && (
                <span className="text-[0.6rem] font-bold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700">
                  👨‍👩‍👧 שותף על ידי {membership.sharedBy ?? "בן משפחה"}
                </span>
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

            {membership.isPaidMembership && unused && !membership.isShared && (
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

        {/* Delete button — owner only */}
        {!membership.isShared && (
          <button
            onClick={() => onRemove(membership.id)}
            className="p-1.5 rounded-xl text-ink-faint hover:text-danger transition-colors shrink-0 mt-0.5"
            aria-label={`הסר חברות ל${membership.clubName}`}
          >
            <Trash2 size={16} />
          </button>
        )}
      </div>

      {/* ── Family sharing toggle — owner only ────────────────────── */}
      {!membership.isShared && isInFamilyGroup && onShareToggle && (
        <div className="flex items-center justify-between pt-3 mt-2 border-t border-surface-border">
          <div className="flex items-center gap-1.5">
            <Users size={13} className="text-ink-faint" />
            <span className="text-xs text-ink-muted">שתף עם המשפחה 👨‍👩‍👧</span>
          </div>
          <button
            onClick={handleShareToggle}
            disabled={toggling}
            className={cn(
              "relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent",
              "transition-colors duration-200 ease-in-out focus:outline-none",
              "disabled:opacity-50",
              membership.isSharedWithFamily ? "bg-blue-500" : "bg-surface-border"
            )}
            role="switch"
            aria-checked={membership.isSharedWithFamily}
            aria-label="שתף עם המשפחה"
          >
            <span
              className={cn(
                "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow",
                "transition duration-200 ease-in-out",
                membership.isSharedWithFamily ? "translate-x-4" : "translate-x-0"
              )}
            />
          </button>
        </div>
      )}
    </div>
  );
}
