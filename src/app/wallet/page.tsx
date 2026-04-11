"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, RefreshCw } from "lucide-react";
import { GiftCardItem }     from "@/components/wallet/GiftCardItem";
import { MembershipItemCard } from "@/components/wallet/MembershipItem";
import { Button }           from "@/components/ui/Button";
import { useGiftCards, useMemberships } from "@/hooks/useWallet";
import { cn } from "@/lib/utils";

type Tab = "cards" | "memberships" | "archive";

export default function WalletPage() {
  const [tab, setTab] = useState<Tab>("cards");

  const {
    cards:       activeCards,
    loading:     cardsLoading,
    reload:      reloadCards,
    toggleFavorite,
    updateBalance,
    archiveCard,
  } = useGiftCards(false);

  const {
    cards:    archivedCards,
    loading:  archLoading,
    reload:   reloadArchive,
    restoreCard,
  } = useGiftCards(true);

  const {
    memberships,
    loading: membLoading,
    removeMembership,
  } = useMemberships();

  const loading = cardsLoading || membLoading;

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: "cards",       label: "כרטיסי מתנה",  count: activeCards.length },
    { id: "memberships", label: "מועדונים",      count: memberships.length },
    { id: "archive",     label: "ארכיון",        count: archivedCards.length },
  ];

  return (
    <div className="page-container py-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-ink">הארנק שלי</h1>
          <p className="text-xs text-ink-muted">ניהול כרטיסי מתנה ומועדונים</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { reloadCards(); reloadArchive(); }}
            className="p-2 rounded-2xl text-ink-faint hover:bg-surface-muted transition-colors"
            aria-label="רענן"
          >
            <RefreshCw size={18} />
          </button>
          <Link href="/wallet/add">
            <Button size="sm">
              <Plus size={15} />
              הוסף
            </Button>
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-surface-muted rounded-2xl p-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "flex-1 text-xs font-semibold py-2 rounded-xl transition-colors flex items-center justify-center gap-1",
              tab === t.id
                ? "bg-white text-brand-600 shadow-sm"
                : "text-ink-muted hover:text-ink"
            )}
          >
            {t.label}
            {(t.count ?? 0) > 0 && (
              <span className={cn(
                "text-[0.55rem] font-bold rounded-full px-1.5 py-0.5",
                tab === t.id ? "bg-brand-100 text-brand-600" : "bg-surface-border text-ink-faint"
              )}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading && tab !== "archive" ? (
        <div className="space-y-3 animate-pulse">
          {[1, 2, 3].map((i) => <div key={i} className="card h-32 bg-surface-muted" />)}
        </div>
      ) : (
        <>
          {/* ── Gift cards ────────────────────────────────────────────── */}
          {tab === "cards" && (
            <div className="space-y-3">
              {!activeCards.length ? (
                <EmptyState
                  emoji="💳"
                  title="אין כרטיסי מתנה"
                  desc="הוסף את כרטיסי המתנה שלך וקבל המלצות חיסכון"
                  href="/wallet/add"
                  cta="הוסף כרטיס"
                />
              ) : (
                activeCards.map((card) => (
                  <GiftCardItem
                    key={card.id}
                    card={card}
                    onFavorite={toggleFavorite}
                    onBalanceUpdate={updateBalance}
                    onArchive={archiveCard}
                  />
                ))
              )}
            </div>
          )}

          {/* ── Memberships ───────────────────────────────────────────── */}
          {tab === "memberships" && (
            <div className="space-y-3">
              {!memberships.length ? (
                <EmptyState
                  emoji="🏷️"
                  title="אין מועדונים"
                  desc="הוסף את חברויות המועדון שלך לקבלת הנחות"
                  href="/wallet/add?tab=club"
                  cta="הוסף מועדון"
                />
              ) : (
                memberships.map((m) => (
                  <MembershipItemCard
                    key={m.id}
                    membership={m}
                    onRemove={removeMembership}
                  />
                ))
              )}
            </div>
          )}

          {/* ── Archive ───────────────────────────────────────────────── */}
          {tab === "archive" && (
            <div className="space-y-3">
              {archLoading ? (
                <div className="space-y-3 animate-pulse">
                  {[1, 2].map((i) => <div key={i} className="card h-28 bg-surface-muted" />)}
                </div>
              ) : !archivedCards.length ? (
                <EmptyState
                  emoji="🗂️"
                  title="הארכיון ריק"
                  desc="כרטיסים שפגו תוקפם יופיעו כאן"
                />
              ) : (
                archivedCards.map((card) => (
                  <GiftCardItem
                    key={card.id}
                    card={card}
                    onFavorite={toggleFavorite}
                    onBalanceUpdate={updateBalance}
                    onArchive={archiveCard}
                    onRestore={restoreCard}
                    isArchiveView
                  />
                ))
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function EmptyState({
  emoji, title, desc, href, cta,
}: {
  emoji: string; title: string; desc: string; href?: string; cta?: string;
}) {
  return (
    <div className="flex flex-col items-center py-14 text-center gap-3">
      <div className="w-16 h-16 rounded-full bg-brand-50 flex items-center justify-center text-3xl">
        {emoji}
      </div>
      <h3 className="text-sm font-bold text-ink">{title}</h3>
      <p className="text-xs text-ink-muted max-w-[200px]">{desc}</p>
      {href && cta && (
        <Link href={href}>
          <Button size="sm" className="mt-2">
            <Plus size={14} />
            {cta}
          </Button>
        </Link>
      )}
    </div>
  );
}
