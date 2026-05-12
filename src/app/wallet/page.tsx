"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Plus, RefreshCw, AlertTriangle, X, Archive,
  CreditCard, BadgeCheck,
} from "lucide-react";
import { GiftCardItem }       from "@/components/wallet/GiftCardItem";
import { MembershipItemCard } from "@/components/wallet/MembershipItem";
import { Button }             from "@/components/ui/Button";
import { useGiftCards, useMemberships } from "@/hooks/useWallet";
import { getToken } from "@/hooks/useAuth";
import { toast }    from "@/hooks/useToast";
import { cn }       from "@/lib/utils";

type Tab     = "cards" | "memberships";
type SortBy  = "expiry" | "balance";

interface Network { id: string; name: string; logoUrl: string | null; }
interface Club    { id: string; name: string; }

export default function WalletPage() {
  const [tab,     setTab]     = useState<Tab>("cards");
  const [sortBy,  setSortBy]  = useState<SortBy>("expiry");

  // ── Family group membership ───────────────────────────────────────────────
  const [isInFamilyGroup, setIsInFamilyGroup] = useState(false);

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    fetch("/api/family/group", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setIsInFamilyGroup(!!data))
      .catch(() => {});
  }, []);

  // ── Add card modal ────────────────────────────────────────────────────────
  const [addCard,        setAddCard]        = useState(false);
  const [networks,       setNetworks]       = useState<Network[]>([]);
  const [cardNetworkId,  setCardNetworkId]  = useState("");
  const [cardNumber,     setCardNumber]     = useState("");
  const [cardBalance,    setCardBalance]    = useState("");
  const [cardExpiry,     setCardExpiry]     = useState("");
  const [cardFavorite,   setCardFavorite]   = useState(false);
  const [savingCard,     setSavingCard]     = useState(false);

  // ── Add membership modal ──────────────────────────────────────────────────
  const [addMemb,        setAddMemb]        = useState(false);
  const [clubs,          setClubs]          = useState<Club[]>([]);
  const [membClubId,     setMembClubId]     = useState("");
  const [membExpiry,     setMembExpiry]     = useState("");
  const [membPaid,       setMembPaid]       = useState(false);
  const [membFee,        setMembFee]        = useState("");
  const [savingMemb,     setSavingMemb]     = useState(false);

  // ── Wallet hooks ──────────────────────────────────────────────────────────
  const {
    cards:   activeCards,
    loading: cardsLoading,
    reload:  reloadCards,
    toggleFavorite,
    updateBalance,
    archiveCard,
    toggleCardSharing,
  } = useGiftCards(false);

  const {
    memberships,
    loading:               membLoading,
    reload:                reloadMemberships,
    removeMembership,
    toggleMembershipSharing,
  } = useMemberships();

  const loading = cardsLoading || membLoading;

  // ── Expiry warnings ───────────────────────────────────────────────────────
  const expiringMemberships = useMemo(() =>
    memberships.filter((m) => {
      if (!m.expiryDate) return false;
      const days = Math.ceil((new Date(m.expiryDate).getTime() - Date.now()) / 86_400_000);
      return days > 0 && days <= 30;
    }),
  [memberships]);

  // ── Sort cards ────────────────────────────────────────────────────────────
  const sortedCards = useMemo(() => {
    const copy = [...activeCards];
    copy.sort((a, b) => {
      if (a.isShared !== b.isShared) return a.isShared ? 1 : -1; // own cards first
      if (a.isFavorite !== b.isFavorite) return a.isFavorite ? -1 : 1;
      const aZero = a.balance === 0;
      const bZero = b.balance === 0;
      if (aZero !== bZero) return aZero ? 1 : -1;
      if (sortBy === "balance") return b.balance - a.balance;
      return new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime();
    });
    return copy;
  }, [activeCards, sortBy]);

  // ── Load networks / clubs lazily ──────────────────────────────────────────
  const loadNetworks = useCallback(async () => {
    if (networks.length) return;
    try {
      const res = await fetch("/api/wallet/networks", {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.ok) setNetworks(await res.json());
    } catch { /* ignore */ }
  }, [networks.length]);

  const loadClubs = useCallback(async () => {
    if (clubs.length) return;
    try {
      const res = await fetch("/api/wallet/clubs", {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.ok) setClubs(await res.json());
    } catch { /* ignore */ }
  }, [clubs.length]);

  useEffect(() => { if (addCard) loadNetworks(); }, [addCard, loadNetworks]);
  useEffect(() => { if (addMemb) loadClubs(); },   [addMemb, loadClubs]);

  // ── Submit add card ───────────────────────────────────────────────────────
  async function submitCard() {
    const balance = parseFloat(cardBalance);
    if (!cardExpiry) { toast({ type: "warning", title: "יש לבחור תאריך תפוגה" }); return; }
    if (isNaN(balance) || balance < 0) { toast({ type: "warning", title: "יתרה לא תקינה" }); return; }
    if (cardNumber && !/^\d{4,}$/.test(cardNumber)) {
      toast({ type: "warning", title: "מספר כרטיס חייב להכיל לפחות 4 ספרות" }); return;
    }

    setSavingCard(true);
    try {
      const res = await fetch("/api/wallet/cards", {
        method:  "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({
          networkId:  cardNetworkId || undefined,
          cardNumber: cardNumber || undefined,
          balance,
          expiryDate: cardExpiry,
          isFavorite: cardFavorite,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "שגיאה");
      toast({ type: "success", title: "הכרטיס נוסף לארנק" });
      setAddCard(false);
      resetCardForm();
      reloadCards();
    } catch (err: any) {
      toast({ type: "error", title: "שגיאה", description: err.message });
    } finally {
      setSavingCard(false);
    }
  }

  function resetCardForm() {
    setCardNetworkId(""); setCardNumber(""); setCardBalance("");
    setCardExpiry(""); setCardFavorite(false);
  }

  // ── Submit add membership ─────────────────────────────────────────────────
  async function submitMemb() {
    if (!membClubId) { toast({ type: "warning", title: "יש לבחור מועדון" }); return; }
    if (!membExpiry) { toast({ type: "warning", title: "יש להזין תאריך תפוגה" }); return; }
    if (new Date(membExpiry) <= new Date()) {
      toast({ type: "warning", title: "תאריך התפוגה חייב להיות בעתיד" }); return;
    }
    const fee = membPaid ? parseFloat(membFee) : 0;
    if (membPaid && (isNaN(fee) || fee < 0)) {
      toast({ type: "warning", title: "דמי החברות לא תקינים" }); return;
    }

    setSavingMemb(true);
    try {
      const res = await fetch("/api/wallet/memberships", {
        method:  "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({
          clubId:          membClubId,
          expiryDate:      membExpiry,
          isPaidMembership: membPaid,
          monthlyFee:      fee,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "שגיאה");
      toast({ type: "success", title: "החברות נוספה לארנק" });
      setAddMemb(false);
      resetMembForm();
      reloadMemberships();
    } catch (err: any) {
      toast({ type: "error", title: "שגיאה", description: err.message });
    } finally {
      setSavingMemb(false);
    }
  }

  function resetMembForm() {
    setMembClubId(""); setMembExpiry(""); setMembPaid(false); setMembFee("");
  }

  // ── Tabs ──────────────────────────────────────────────────────────────────
  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: "cards",       label: "כרטיסי מתנה", count: activeCards.length },
    { id: "memberships", label: "מועדונים",     count: memberships.length },
  ];

  return (
    <div className="page-container py-4 space-y-4 pb-24">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-ink">הארנק שלי</h1>
          <p className="text-xs text-ink-muted">ניהול כרטיסי מתנה ומועדונים</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { reloadCards(); reloadMemberships(); }}
            className="p-2 rounded-2xl text-ink-faint hover:bg-surface-muted transition-colors"
            aria-label="רענן"
          >
            <RefreshCw size={18} />
          </button>
          <Link
            href="/wallet/archive"
            className="inline-flex items-center gap-1 px-3 py-2 rounded-2xl text-xs font-medium text-ink-muted hover:bg-surface-muted transition-colors"
          >
            <Archive size={15} />
            ארכיון
          </Link>
        </div>
      </div>

      {/* Expiry banner */}
      {expiringMemberships.length > 0 && (
        <div className="flex items-start gap-2 bg-danger-50 border border-danger-200 rounded-2xl p-3">
          <AlertTriangle size={16} className="text-danger shrink-0 mt-0.5" />
          <p className="text-xs font-semibold text-danger">
            {expiringMemberships.length === 1
              ? `חברות ב${expiringMemberships[0].clubName} פוקעת בקרוב`
              : `${expiringMemberships.length} חברויות מועדון פוקעות בקרוב`}
          </p>
        </div>
      )}

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

      {/* Sort (cards tab only) */}
      {tab === "cards" && activeCards.length > 1 && (
        <div className="flex items-center gap-2 text-xs">
          <span className="text-ink-muted">מיון לפי:</span>
          {(["expiry", "balance"] as SortBy[]).map((s) => (
            <button
              key={s}
              onClick={() => setSortBy(s)}
              className={cn(
                "px-3 py-1 rounded-full border transition-colors",
                sortBy === s
                  ? "border-brand-400 bg-brand-50 text-brand-700 font-semibold"
                  : "border-surface-border text-ink-muted hover:border-brand-300"
              )}
            >
              {s === "expiry" ? "תפוגה" : "יתרה"}
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="space-y-3 animate-pulse">
          {[1, 2, 3].map((i) => <div key={i} className="card h-32 bg-surface-muted" />)}
        </div>
      ) : (
        <>
          {tab === "cards" && (
            <div className="space-y-3">
              {!sortedCards.length ? (
                <EmptyState
                  emoji="💳"
                  title="אין כרטיסי מתנה"
                  desc="הוסף את כרטיסי המתנה שלך"
                  onAdd={() => setAddCard(true)}
                  cta="הוסף כרטיס"
                />
              ) : (
                sortedCards.map((card) => (
                  <GiftCardItem
                    key={card.id}
                    card={card}
                    onFavorite={toggleFavorite}
                    onBalanceUpdate={updateBalance}
                    onArchive={archiveCard}
                    onShareToggle={toggleCardSharing}
                    isInFamilyGroup={isInFamilyGroup}
                  />
                ))
              )}
            </div>
          )}

          {tab === "memberships" && (
            <div className="space-y-3">
              {!memberships.length ? (
                <EmptyState
                  emoji="🏷️"
                  title="אין מועדונים"
                  desc="הוסף חברויות מועדון לקבלת הנחות"
                  onAdd={() => setAddMemb(true)}
                  cta="הוסף מועדון"
                />
              ) : (
                memberships.map((m) => (
                  <MembershipItemCard
                    key={m.id}
                    membership={m}
                    onRemove={removeMembership}
                    onShareToggle={toggleMembershipSharing}
                    isInFamilyGroup={isInFamilyGroup}
                  />
                ))
              )}
            </div>
          )}
        </>
      )}

      {/* FAB */}
      <button
        onClick={() => tab === "cards" ? setAddCard(true) : setAddMemb(true)}
        className="fixed bottom-20 left-4 w-14 h-14 rounded-full gradient-header text-white shadow-lg flex items-center justify-center hover:opacity-90 active:scale-95 transition-all z-30"
        aria-label="הוסף"
      >
        <Plus size={24} />
      </button>

      {/* ── Add Card Modal ── */}
      {addCard && (
        <Modal title="הוסף כרטיס מתנה" icon={<CreditCard size={18} />} onClose={() => { setAddCard(false); resetCardForm(); }}>
          <div className="space-y-3">
            <Field label="רשת כרטיסי מתנה">
              <select
                value={cardNetworkId}
                onChange={(e) => setCardNetworkId(e.target.value)}
                className="input"
              >
                <option value="">ללא / לא ידוע</option>
                {networks.map((n) => (
                  <option key={n.id} value={n.id}>{n.name}</option>
                ))}
              </select>
            </Field>

            <Field label="מספר כרטיס (אופציונלי)">
              <input
                type="text"
                inputMode="numeric"
                value={cardNumber}
                onChange={(e) => setCardNumber(e.target.value.replace(/\D/g, ""))}
                placeholder="4 ספרות לפחות"
                className="input"
                dir="ltr"
              />
            </Field>

            <Field label="יתרה (₪)">
              <input
                type="number"
                min="0"
                step="0.01"
                value={cardBalance}
                onChange={(e) => setCardBalance(e.target.value)}
                placeholder="0.00"
                className="input"
                dir="ltr"
              />
            </Field>

            <Field label="תאריך תפוגה">
              <input
                type="date"
                value={cardExpiry}
                min={new Date().toISOString().split("T")[0]}
                onChange={(e) => setCardExpiry(e.target.value)}
                className="input"
              />
            </Field>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={cardFavorite}
                onChange={(e) => setCardFavorite(e.target.checked)}
                className="w-4 h-4 accent-brand-600"
              />
              <span className="text-sm text-ink">סמן כמועדף ⭐</span>
            </label>

            <Button onClick={submitCard} loading={savingCard} className="w-full mt-1">
              הוסף לארנק
            </Button>
          </div>
        </Modal>
      )}

      {/* ── Add Membership Modal ── */}
      {addMemb && (
        <Modal title="הוסף חברות מועדון" icon={<BadgeCheck size={18} />} onClose={() => { setAddMemb(false); resetMembForm(); }}>
          <div className="space-y-3">
            <Field label="מועדון">
              <select
                value={membClubId}
                onChange={(e) => setMembClubId(e.target.value)}
                className="input"
              >
                <option value="">בחר מועדון...</option>
                {clubs.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </Field>

            <Field label="תאריך תפוגה">
              <input
                type="date"
                value={membExpiry}
                min={new Date().toISOString().split("T")[0]}
                onChange={(e) => setMembExpiry(e.target.value)}
                className="input"
              />
            </Field>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={membPaid}
                onChange={(e) => setMembPaid(e.target.checked)}
                className="w-4 h-4 accent-brand-600"
              />
              <span className="text-sm text-ink">חברות בתשלום</span>
            </label>

            {membPaid && (
              <Field label="דמי חברות חודשיים (₪)">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={membFee}
                  onChange={(e) => setMembFee(e.target.value)}
                  placeholder="0.00"
                  className="input"
                  dir="ltr"
                />
              </Field>
            )}

            <Button onClick={submitMemb} loading={savingMemb} className="w-full mt-1">
              הוסף לארנק
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function EmptyState({
  emoji, title, desc, onAdd, cta,
}: {
  emoji: string; title: string; desc: string; onAdd?: () => void; cta?: string;
}) {
  return (
    <div className="flex flex-col items-center py-14 text-center gap-3">
      <div className="w-16 h-16 rounded-full bg-brand-50 flex items-center justify-center text-3xl">
        {emoji}
      </div>
      <h3 className="text-sm font-bold text-ink">{title}</h3>
      <p className="text-xs text-ink-muted max-w-[200px]">{desc}</p>
      {onAdd && cta && (
        <Button size="sm" onClick={onAdd} className="mt-2">
          <Plus size={14} />
          {cta}
        </Button>
      )}
    </div>
  );
}

function Modal({
  title, icon, onClose, children,
}: {
  title: string; icon: React.ReactNode; onClose: () => void; children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end justify-center z-50 p-4">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-surface-border">
          <div className="flex items-center gap-2 text-ink font-bold">
            {icon}
            {title}
          </div>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-surface-muted">
            <X size={18} className="text-ink-faint" />
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-ink-muted">{label}</label>
      {children}
    </div>
  );
}
