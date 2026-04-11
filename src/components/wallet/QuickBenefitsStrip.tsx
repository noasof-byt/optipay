"use client";

import Link from "next/link";
import { Plus, CreditCard, BadgeCheck } from "lucide-react";
import { cn, formatILS, isExpiringSoon } from "@/lib/utils";
import { useGiftCards, useMemberships } from "@/hooks/useWallet";
import { useAuth } from "@/hooks/useAuth";

// ── Mock fallback shown when the user is not logged in ────────────────────────
const MOCK_CARDS = [
  { id: "m1", type: "gift_card" as const,  label: "BuyMe",     hint: "8421", balance: 250, expiryDate: new Date(Date.now() + 20  * 864e5) },
  { id: "m2", type: "membership" as const, label: "הטבות חבר", discount: 10, expiryDate: null },
  { id: "m3", type: "gift_card" as const,  label: "ניופאן",    hint: "3302", balance: 80,  expiryDate: new Date(Date.now() + 90  * 864e5) },
];

// ── Skeleton pill ─────────────────────────────────────────────────────────────
function SkeletonPill() {
  return (
    <div className="snap-item w-32 h-24 rounded-3xl bg-surface-border animate-pulse shrink-0" />
  );
}

// ── Individual card pill ──────────────────────────────────────────────────────
interface CardPillProps {
  id:          string;
  type:        "gift_card" | "membership";
  label:       string;
  hint?:       string | null;
  balance?:    number;
  discount?:   number;
  expiryDate:  Date | string | null;
}

function CardPill({ id, type, label, hint, balance, discount, expiryDate }: CardPillProps) {
  const expiry       = expiryDate ? new Date(expiryDate) : null;
  const expiringSoon = expiry ? isExpiringSoon(expiry, 30) : false;

  return (
    <Link
      href={`/wallet/${id}`}
      className={cn(
        "snap-item flex flex-col justify-between",
        "w-32 h-24 rounded-3xl p-3 shrink-0",
        "shadow-card transition-transform active:scale-95",
        type === "gift_card"
          ? "bg-gradient-to-br from-brand-600 to-brand-700 text-white"
          : "bg-gradient-to-br from-sky-400 to-sky-600 text-white",
        expiringSoon && "ring-2 ring-warning"
      )}
    >
      {/* Label row */}
      <div className="flex items-center gap-1.5">
        {type === "gift_card"
          ? <CreditCard size={14} className="opacity-80" />
          : <BadgeCheck size={14} className="opacity-80" />
        }
        <span className="text-xs font-semibold opacity-90 truncate">{label}</span>
      </div>

      {/* Value */}
      <div>
        {type === "gift_card" && balance !== undefined ? (
          <>
            <p className="text-base font-extrabold leading-tight">{formatILS(balance, 0)}</p>
            {hint && <p className="text-[0.6rem] opacity-70">•••• {hint}</p>}
          </>
        ) : (
          <>
            <p className="text-base font-extrabold leading-tight">{discount ?? 0}%</p>
            <p className="text-[0.6rem] opacity-70">הנחת מועדון</p>
          </>
        )}
        {expiringSoon && (
          <span className="inline-block mt-1 text-[0.55rem] font-bold bg-warning text-white rounded-full px-1.5 py-0.5">
            פג תוקף בקרוב
          </span>
        )}
      </div>
    </Link>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export function QuickBenefitsStrip() {
  const { user, loading: authLoading } = useAuth();

  // Only fetch real data when the user is logged in
  const { cards,       loading: cardsLoading }       = useGiftCards(false);
  const { memberships, loading: membershipsLoading } = useMemberships();

  const isLoading = authLoading || cardsLoading || membershipsLoading;

  // ── Not logged in: show mock cards with a soft opacity ──────────────────
  if (!authLoading && !user) {
    return (
      <div className="relative">
        <div className="scroll-x-snap opacity-40 pointer-events-none select-none">
          <div className={cn(
            "snap-item flex flex-col items-center justify-center gap-1.5",
            "w-20 h-24 rounded-3xl border-2 border-dashed border-brand-300",
            "text-brand-400 shrink-0"
          )}>
            <Plus size={22} />
            <span className="text-[0.6rem] font-semibold text-center leading-tight">הוסף כרטיס</span>
          </div>
          {MOCK_CARDS.map((c) => (
            <CardPill key={c.id} id={c.id} type={c.type} label={c.label}
              hint={"hint" in c ? c.hint : undefined}
              balance={"balance" in c ? c.balance : undefined}
              discount={"discount" in c ? c.discount : undefined}
              expiryDate={c.expiryDate}
            />
          ))}
        </div>
        <div className="absolute inset-0 flex items-center justify-center">
          <Link href="/login" className="btn-primary text-xs px-4 py-2 shadow-float">
            התחבר לצפייה בארנק
          </Link>
        </div>
      </div>
    );
  }

  // ── Loading skeleton ────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="scroll-x-snap">
        <SkeletonPill />
        <SkeletonPill />
        <SkeletonPill />
      </div>
    );
  }

  // ── Real data ───────────────────────────────────────────────────────────
  const hasContent = cards.length > 0 || memberships.length > 0;

  return (
    <div className="scroll-x-snap">
      {/* Add card CTA */}
      <Link
        href="/wallet/add"
        className={cn(
          "snap-item flex flex-col items-center justify-center gap-1.5",
          "w-20 h-24 rounded-3xl border-2 border-dashed border-brand-300",
          "text-brand-400 hover:bg-brand-50 transition-colors shrink-0"
        )}
        aria-label="הוסף כרטיס חדש"
      >
        <Plus size={22} />
        <span className="text-[0.6rem] font-semibold text-center leading-tight">הוסף כרטיס</span>
      </Link>

      {/* Gift cards */}
      {cards.map((c) => (
        <CardPill
          key={c.id}
          id={c.id}
          type="gift_card"
          label={c.networkName ?? c.storeSpecificName ?? "כרטיס מתנה"}
          hint={c.cardNumberHint}
          balance={c.balance}
          expiryDate={c.expiryDate}
        />
      ))}

      {/* Memberships */}
      {memberships.map((m) => (
        <CardPill
          key={m.id}
          id={m.id}
          type="membership"
          label={m.clubName}
          discount={m.baseDiscount}
          expiryDate={m.expiryDate}
        />
      ))}

      {/* Empty state (logged in but nothing added yet) */}
      {!hasContent && (
        <div className="snap-item flex items-center justify-center w-48 h-24 rounded-3xl bg-surface-muted text-ink-muted text-xs text-center px-3 shrink-0">
          עדיין אין כרטיסים בארנק — הוסף את הראשון!
        </div>
      )}
    </div>
  );
}
