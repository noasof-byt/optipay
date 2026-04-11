"use client";

import { useState } from "react";
import {
  ExternalLink, CheckCircle2, ChevronDown, ChevronUp,
  AlertTriangle, CreditCard, BadgeCheck,
} from "lucide-react";
import { BuyingRoute } from "@/types/search";
import { formatILS }   from "@/lib/utils";
import { Button }      from "@/components/ui/Button";
import { toast }       from "@/hooks/useToast";
import { cn }          from "@/lib/utils";

interface Props {
  route:       BuyingRoute;
  rank:        number;
  isBest:      boolean;
  productName: string;
}

export function BuyingRouteCard({ route, rank, isBest, productName }: Props) {
  const [expanded, setExpanded] = useState(isBest);
  const [using,    setUsing]    = useState(false);
  const [used,     setUsed]     = useState(false);

  async function handleUseRoute() {
    setUsing(true);
    try {
      const res = await fetch("/api/routes/use", {
        method:  "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization:  `Bearer ${localStorage.getItem("optipay_token") ?? ""}`,
        },
        body: JSON.stringify({ route, productName }),
      });

      if (!res.ok) {
        const err = await res.json();
        toast({ type: "error", title: "שגיאה", description: err.message });
        return;
      }

      setUsed(true);
      toast({
        type:        "success",
        title:       "מעולה! נרשם החיסכון שלך 🎉",
        description: `חסכת ${formatILS(route.savedAmount)} ב${route.storeName}`,
      });
    } catch {
      toast({ type: "error", title: "שגיאת רשת", description: "נסה שוב" });
    } finally {
      setUsing(false);
    }
  }

  const hasDiscount = route.discounts.length > 0 && route.savedAmount > 0;

  return (
    <article
      className={cn(
        "card overflow-hidden transition-shadow",
        isBest && "ring-2 ring-accent-400 shadow-float",
        used && "opacity-60"
      )}
    >
      {/* ── Rank ribbon ──────────────────────────────────────────────────── */}
      {isBest && (
        <div className="bg-accent-500 text-white text-[0.6rem] font-bold px-3 py-1 text-center tracking-wider">
          ✓ המחיר הזול ביותר
        </div>
      )}

      <div className="p-4">
        {/* ── Store + price row ─────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            {/* Rank + store name */}
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-xs font-bold text-ink-faint">#{rank}</span>
              <h3 className="text-sm font-bold text-ink truncate">{route.storeName}</h3>
              {route.noDoubleDiscount && (
                <AlertTriangle size={13} className="text-warning shrink-0" />
              )}
            </div>

            {/* Original price (struck through if discounted) */}
            {hasDiscount && (
              <p className="text-xs text-ink-faint line-through">
                {formatILS(route.originalPrice)}
              </p>
            )}
          </div>

          {/* Final price */}
          <div className="text-right shrink-0">
            <p className={cn(
              "text-xl font-extrabold leading-tight",
              hasDiscount ? "text-accent-600" : "text-ink"
            )}>
              {formatILS(route.finalPrice)}
            </p>
            {hasDiscount && (
              <p className="text-xs font-semibold text-accent-500">
                חסכון {formatILS(route.savedAmount)} ({route.savedPercent}%)
              </p>
            )}
          </div>
        </div>

        {/* ── Discount badges ───────────────────────────────────────────── */}
        {route.discounts.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {route.discounts.map((d, i) => (
              <span
                key={i}
                className={cn(
                  "badge text-xs",
                  d.type === "club"
                    ? "bg-brand-100 text-brand-700"
                    : "bg-accent-100 text-accent-700"
                )}
              >
                {d.type === "club" ? (
                  <BadgeCheck size={11} />
                ) : (
                  <CreditCard size={11} />
                )}
                {d.label}
              </span>
            ))}
          </div>
        )}

        {/* ── No-double-dipping warning ─────────────────────────────────── */}
        {route.warning && (
          <p className="text-[0.65rem] text-warning-700 bg-warning-light rounded-xl px-3 py-1.5 mb-3">
            ⚠️ {route.warning}
          </p>
        )}

        {/* ── Expanded: discount breakdown ──────────────────────────────── */}
        {expanded && route.discounts.length > 0 && (
          <div className="border-t border-surface-border pt-3 mb-3 space-y-1.5 text-xs text-ink-muted">
            <div className="flex justify-between">
              <span>מחיר מקורי</span>
              <span>{formatILS(route.originalPrice)}</span>
            </div>
            {route.discounts.map((d, i) => (
              <div key={i} className="flex justify-between text-accent-600">
                <span>{d.label}</span>
                <span>− {formatILS(d.amountDeducted)}</span>
              </div>
            ))}
            <div className="flex justify-between font-bold text-ink border-t border-surface-border pt-1.5">
              <span>סה״כ לתשלום</span>
              <span>{formatILS(route.finalPrice)}</span>
            </div>
          </div>
        )}

        {/* ── Action buttons ────────────────────────────────────────────── */}
        <div className="flex gap-2">
          {/* Go to store */}
          <a
            href={route.storeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary flex-1 text-xs h-9 rounded-xl flex items-center justify-center gap-1.5"
          >
            לחנות
            <ExternalLink size={13} />
          </a>

          {/* I used this route */}
          {!used ? (
            <Button
              variant="accent"
              size="sm"
              className="flex-1 text-xs rounded-xl"
              onClick={handleUseRoute}
              loading={using}
              disabled={used}
            >
              <CheckCircle2 size={14} />
              קניתי כאן
            </Button>
          ) : (
            <div className="flex-1 flex items-center justify-center gap-1.5 text-xs text-accent-600 font-semibold">
              <CheckCircle2 size={14} />
              נרשם ✓
            </div>
          )}

          {/* Expand/collapse */}
          {route.discounts.length > 0 && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="p-2 rounded-xl text-ink-faint hover:bg-surface-muted transition-colors"
              aria-label={expanded ? "קפל" : "הרחב"}
            >
              {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
