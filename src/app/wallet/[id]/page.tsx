"use client";

import { useEffect, useState }       from "react";
import { useParams, useRouter }      from "next/navigation";
import { Calendar, Clock, Star, Archive, Trash2, RefreshCw } from "lucide-react";
import { Button }                    from "@/components/ui/Button";
import { toast }                     from "@/hooks/useToast";
import { cn }                        from "@/lib/utils";

type CardDetail = {
  id: string;
  last4: string;
  balance: number;
  expiresAt: string | null;
  isFavorite: boolean;
  isArchived: boolean;
  usageCount: number;
  lastUsedAt: string | null;
  network: { name: string; logoUrl: string | null } | null;
  usageLogs: {
    id: string;
    amountDeducted: number;
    balanceBefore: number;
    balanceAfter: number;
    productName: string;
    createdAt: string;
  }[];
};

type MembershipDetail = {
  id: string;
  isActive: boolean;
  isPaid: boolean;
  discountPercent: number | null;
  joinedAt: string;
  lastUsedAt: string | null;
  club: { name: string; description: string | null; logoUrl: string | null };
};

export default function WalletDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [loading, setLoading]     = useState(true);
  const [cardData, setCardData]   = useState<CardDetail | null>(null);
  const [memData,  setMemData]    = useState<MembershipDetail | null>(null);
  const [editing,  setEditing]    = useState(false);
  const [newBal,   setNewBal]     = useState("");

  const token = typeof window !== "undefined"
    ? localStorage.getItem("optipay_token") ?? ""
    : "";

  async function load() {
    setLoading(true);
    const headers = { Authorization: `Bearer ${token}` };
    try {
      // Try gift card first, then membership
      const cardRes = await fetch(`/api/wallet/cards/${params.id}`, { headers });
      if (cardRes.ok) {
        const { card } = await cardRes.json();
        setCardData(card);
        setNewBal(String(card.balance));
        return;
      }
      const memRes = await fetch(`/api/wallet/memberships/${params.id}`, { headers });
      if (memRes.ok) {
        const { membership } = await memRes.json();
        setMemData(membership);
        return;
      }
      toast({ type: "error", title: "פריט לא נמצא" });
      router.replace("/wallet");
    } catch {
      toast({ type: "error", title: "שגיאת רשת" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [params.id]);

  async function updateBalance() {
    const val = parseFloat(newBal);
    if (isNaN(val) || val < 0) {
      toast({ type: "error", title: "יתרה לא תקינה" });
      return;
    }
    const res = await fetch(`/api/wallet/cards/${params.id}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body:    JSON.stringify({ balance: val }),
    });
    if (res.ok) {
      setCardData((prev) => prev ? { ...prev, balance: val } : prev);
      setEditing(false);
      toast({ type: "success", title: "היתרה עודכנה ✓" });
    }
  }

  async function toggleFavorite() {
    if (!cardData) return;
    const res = await fetch(`/api/wallet/cards/${params.id}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body:    JSON.stringify({ isFavorite: !cardData.isFavorite }),
    });
    if (res.ok) {
      setCardData((prev) => prev ? { ...prev, isFavorite: !prev.isFavorite } : prev);
    }
  }

  async function archiveCard() {
    const res = await fetch(`/api/wallet/cards/${params.id}`, {
      method:  "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      toast({ type: "info", title: "הכרטיס הועבר לארכיון" });
      router.replace("/wallet");
    }
  }

  async function removeClub() {
    const res = await fetch(`/api/wallet/memberships/${params.id}`, {
      method:  "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      toast({ type: "info", title: "החברות הוסרה" });
      router.replace("/wallet");
    }
  }

  if (loading) {
    return (
      <div className="page-container py-6 space-y-4">
        <div className="card h-40 animate-pulse bg-surface-muted" />
        <div className="card h-24 animate-pulse bg-surface-muted" />
        <div className="card h-48 animate-pulse bg-surface-muted" />
      </div>
    );
  }

  // ── Gift card detail ────────────────────────────────────────────────────────
  if (cardData) {
    const expiring = cardData.expiresAt
      ? (new Date(cardData.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24) < 30
      : false;

    return (
      <div className="page-container py-4 space-y-4">
        {/* Card hero */}
        <div className="card p-5 rounded-3xl gradient-header text-white">
          <div className="flex items-start justify-between mb-6">
            <div>
              <p className="text-xs opacity-75">{cardData.network?.name ?? "כרטיס מתנה"}</p>
              <p className="text-lg font-bold mt-0.5">···· {cardData.last4}</p>
            </div>
            <button onClick={toggleFavorite} aria-label={cardData.isFavorite ? "הסר מועדפים" : "הוסף למועדפים"}>
              <Star
                size={20}
                className={cardData.isFavorite ? "fill-white" : "opacity-50"}
              />
            </button>
          </div>

          <div>
            <p className="text-xs opacity-75">יתרה</p>
            {editing ? (
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="number"
                  value={newBal}
                  onChange={(e) => setNewBal(e.target.value)}
                  className="w-28 px-2 py-1 rounded-lg text-ink text-sm"
                  autoFocus
                />
                <button onClick={updateBalance} className="text-xs bg-white/20 px-2 py-1 rounded-lg">שמור</button>
                <button onClick={() => setEditing(false)} className="text-xs opacity-60">ביטול</button>
              </div>
            ) : (
              <button
                onClick={() => setEditing(true)}
                className="flex items-center gap-2 group"
                aria-label="ערוך יתרה"
              >
                <span className="text-2xl font-extrabold">₪{Number(cardData.balance).toFixed(2)}</span>
                <span className="text-xs opacity-0 group-hover:opacity-75 transition-opacity">ערוך</span>
              </button>
            )}
          </div>

          {cardData.expiresAt && (
            <div className={cn("flex items-center gap-1 mt-3 text-xs", expiring ? "opacity-100" : "opacity-60")}>
              <Calendar size={12} />
              <span>
                {expiring ? "⚠ פג תוקף בקרוב — " : "תוקף עד "}
                {new Date(cardData.expiresAt).toLocaleDateString("he-IL")}
              </span>
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="card p-4 grid grid-cols-2 gap-3">
          <Stat label="כמות שימושים" value={String(cardData.usageCount)} />
          <Stat
            label="שימוש אחרון"
            value={cardData.lastUsedAt
              ? new Date(cardData.lastUsedAt).toLocaleDateString("he-IL")
              : "טרם נוצל"}
          />
        </div>

        {/* Usage log */}
        {cardData.usageLogs.length > 0 && (
          <section>
            <h2 className="section-title mb-2">היסטוריית שימוש</h2>
            <div className="card overflow-hidden divide-y divide-surface-border">
              {cardData.usageLogs.map((log) => (
                <div key={log.id} className="px-4 py-3 flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-ink truncate">{log.productName}</p>
                    <p className="text-xs text-ink-muted mt-0.5 flex items-center gap-1">
                      <Clock size={10} />
                      {new Date(log.createdAt).toLocaleDateString("he-IL")}
                    </p>
                  </div>
                  <div className="text-left shrink-0">
                    <p className="text-sm font-bold text-danger">−₪{log.amountDeducted.toFixed(2)}</p>
                    <p className="text-xs text-ink-faint">יתרה: ₪{log.balanceAfter.toFixed(2)}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={archiveCard}
            className="flex-1 gap-1.5"
          >
            <Archive size={14} />
            {cardData.isArchived ? "שחזר לארנק" : "העבר לארכיון"}
          </Button>
        </div>
      </div>
    );
  }

  // ── Membership detail ───────────────────────────────────────────────────────
  if (memData) {
    return (
      <div className="page-container py-4 space-y-4">
        {/* Club hero */}
        <div className="card p-5 rounded-3xl gradient-header text-white">
          <p className="text-xl font-extrabold">{memData.club.name}</p>
          {memData.club.description && (
            <p className="text-sm opacity-75 mt-1">{memData.club.description}</p>
          )}
          {memData.discountPercent !== null && (
            <p className="text-3xl font-extrabold mt-4">{memData.discountPercent}% הנחה</p>
          )}
          {memData.isPaid && (
            <span className="mt-2 inline-block text-xs bg-white/20 px-2 py-0.5 rounded-full">
              מועדון בתשלום
            </span>
          )}
        </div>

        {/* Stats */}
        <div className="card p-4 grid grid-cols-2 gap-3">
          <Stat
            label="חבר מאז"
            value={new Date(memData.joinedAt).toLocaleDateString("he-IL")}
          />
          <Stat
            label="שימוש אחרון"
            value={memData.lastUsedAt
              ? new Date(memData.lastUsedAt).toLocaleDateString("he-IL")
              : "טרם נוצל"}
          />
        </div>

        {/* Actions */}
        <Button
          variant="danger"
          size="sm"
          onClick={removeClub}
          className="w-full gap-1.5"
        >
          <Trash2 size={14} />
          הסר חברות
        </Button>
      </div>
    );
  }

  return null;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center">
      <p className="text-xs text-ink-muted">{label}</p>
      <p className="text-base font-bold text-ink mt-0.5">{value}</p>
    </div>
  );
}
