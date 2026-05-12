"use client";

import { useState } from "react";
import {
  Star, Archive, RotateCcw, Pencil, CreditCard, CheckCircle2,
} from "lucide-react";
import { cn, formatILS, formatDateHe, isExpiringSoon, isExpired } from "@/lib/utils";
import { GiftCardItem as CardType } from "@/hooks/useWallet";
import { Button } from "@/components/ui/Button";
import { Input }  from "@/components/ui/Input";

interface Props {
  card:           CardType;
  onFavorite:     (id: string, v: boolean) => void;
  onBalanceUpdate:(id: string, v: number)  => void;
  onArchive:      (id: string) => void;
  onRestore?:     (id: string) => void;
  isArchiveView?: boolean;
}

export function GiftCardItem({
  card, onFavorite, onBalanceUpdate, onArchive, onRestore, isArchiveView,
}: Props) {
  const [editing,     setEditing]     = useState(false);
  const [newBalance,  setNewBalance]  = useState(String(card.balance));
  const [savingBal,   setSavingBal]   = useState(false);

  const expired     = isExpired(card.expiryDate);
  const expiringSoon = !expired && isExpiringSoon(card.expiryDate, 30);

  const cardLabel = card.networkName ?? card.storeSpecificName ?? "כרטיס מתנה";
  const hint      = card.cardNumberHint ? `•••• ${card.cardNumberHint}` : "";
  const isShared  = card.isShared ?? false;

  async function saveBalance() {
    const val = parseFloat(newBalance);
    if (isNaN(val) || val < 0) return;
    setSavingBal(true);
    try {
      await onBalanceUpdate(card.id, val);
      setEditing(false);
    } finally {
      setSavingBal(false);
    }
  }

  return (
    <div className={cn(
      "card flex flex-col gap-3 p-4",
      expired      && "opacity-60",
      expiringSoon && "ring-1 ring-warning"
    )}>
      {/* ── Top row ─────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-9 h-9 rounded-2xl bg-brand-100 flex items-center justify-center shrink-0">
            <CreditCard size={18} className="text-brand-600" />
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <p className="text-sm font-bold text-ink truncate">{cardLabel}</p>
              {isShared && (
                <span className="text-[0.6rem] font-bold px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700">
                  👨‍👩‍👧 משפחתי
                </span>
              )}
            </div>
            <p className="text-xs text-ink-faint">
              {hint}
              {isShared && card.sharedBy && (
                <span className="text-ink-faint"> · שיתף: {card.sharedBy}</span>
              )}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          {!isArchiveView && !isShared && (
            <button
              onClick={() => onFavorite(card.id, !card.isFavorite)}
              className={cn(
                "p-1.5 rounded-xl transition-colors",
                card.isFavorite ? "text-brand-500" : "text-ink-faint hover:text-brand-400"
              )}
              aria-label={card.isFavorite ? "הסר ממועדפים" : "הוסף למועדפים"}
            >
              <Star size={16} fill={card.isFavorite ? "currentColor" : "none"} />
            </button>
          )}

          {!isArchiveView && !isShared ? (
            <button
              onClick={() => onArchive(card.id)}
              className="p-1.5 rounded-xl text-ink-faint hover:text-danger transition-colors"
              aria-label="העבר לארכיון"
            >
              <Archive size={16} />
            </button>
          ) : isArchiveView ? (
            <button
              onClick={() => onRestore?.(card.id)}
              className="p-1.5 rounded-xl text-ink-faint hover:text-accent-500 transition-colors"
              aria-label="שחזר לארנק"
            >
              <RotateCcw size={16} />
            </button>
          ) : null}
        </div>
      </div>

      {/* ── Balance row ──────────────────────────────────────────────── */}
      <div className="flex items-end justify-between">
        <div>
          <p className="text-xs text-ink-muted mb-0.5">יתרה</p>
          {editing ? (
            <div className="flex items-center gap-2">
              <Input
                type="number"
                value={newBalance}
                onChange={(e) => setNewBalance(e.target.value)}
                className="w-28 h-9 text-sm"
                dir="ltr"
                min={0}
                step={0.01}
                autoFocus
              />
              <Button
                size="sm"
                variant="accent"
                className="h-9 px-3"
                loading={savingBal}
                onClick={saveBalance}
              >
                <CheckCircle2 size={14} />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <p className={cn(
                "text-xl font-extrabold",
                card.balance === 0 ? "text-ink-faint" : "text-ink"
              )}>
                {formatILS(card.balance, 0)}
              </p>
              {!isArchiveView && !isShared && (
                <button
                  onClick={() => { setNewBalance(String(card.balance)); setEditing(true); }}
                  className="p-1 rounded-lg text-ink-faint hover:text-ink transition-colors"
                  aria-label="ערוך יתרה"
                >
                  <Pencil size={13} />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Expiry */}
        <div className="text-left">
          <p className="text-xs text-ink-muted mb-0.5">תוקף עד</p>
          <p className={cn(
            "text-xs font-semibold",
            expired      ? "text-danger"  :
            expiringSoon ? "text-warning" :
            "text-ink-muted"
          )}>
            {formatDateHe(card.expiryDate, { day: "2-digit", month: "2-digit", year: "2-digit" })}
          </p>
          {expiringSoon && !expired && (
            <p className="text-[0.6rem] text-warning font-bold">פג תוקף בקרוב!</p>
          )}
          {expired && (
            <p className="text-[0.6rem] text-danger font-bold">פג תוקף</p>
          )}
        </div>
      </div>

      {/* Usage count */}
      {card.usageCount > 0 && (
        <p className="text-[0.65rem] text-ink-faint">
          שימוש {card.usageCount}× · אחרון:{" "}
          {card.lastUsedAt
            ? formatDateHe(card.lastUsedAt, { day: "2-digit", month: "short" })
            : "לא ידוע"}
        </p>
      )}
    </div>
  );
}
