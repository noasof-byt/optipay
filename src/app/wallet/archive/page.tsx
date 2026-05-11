"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, RotateCcw } from "lucide-react";
import { getToken } from "@/hooks/useAuth";
import { toast }    from "@/hooks/useToast";
import { useGiftCards } from "@/hooks/useWallet";
import { formatILS, formatDateHe } from "@/lib/utils";

export default function ArchivePage() {
  const router = useRouter();
  const { cards, loading, restoreCard } = useGiftCards(true);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  async function handleRestore(id: string) {
    setRestoringId(id);
    try {
      await restoreCard(id);
    } catch (err: any) {
      toast({ type: "error", title: "שגיאה בשחזור", description: err.message });
    } finally {
      setRestoringId(null);
    }
  }

  return (
    <div className="page-container py-4 space-y-4">

      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="p-2 rounded-2xl text-ink-faint hover:bg-surface-muted transition-colors"
          aria-label="חזור"
        >
          <ArrowRight size={20} />
        </button>
        <div>
          <h1 className="text-lg font-bold text-ink">ארכיון כרטיסים</h1>
          <p className="text-xs text-ink-muted">כרטיסים שנוצלו או פגו תוקפם</p>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-3 animate-pulse">
          {[1, 2, 3].map((i) => <div key={i} className="card h-24 bg-surface-muted" />)}
        </div>
      ) : cards.length === 0 ? (
        <div className="flex flex-col items-center py-20 gap-3 text-center">
          <span className="text-5xl">🗂️</span>
          <p className="text-sm font-bold text-ink">אין פריטים בארכיון</p>
          <p className="text-xs text-ink-muted">כרטיסים שפגו תוקפם יופיעו כאן</p>
        </div>
      ) : (
        <div className="space-y-3">
          {cards.map((card) => (
            <div key={card.id} className="card p-4 flex items-center gap-3 opacity-80">
              {/* Icon */}
              <div className="w-12 h-12 rounded-2xl bg-surface-muted flex items-center justify-center text-xl shrink-0">
                💳
              </div>

              {/* Info */}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-ink">
                  {card.networkName ?? "כרטיס מתנה"}
                  {card.cardNumberHint && (
                    <span className="text-ink-faint font-normal text-xs"> ···{card.cardNumberHint}</span>
                  )}
                </p>
                <p className="text-xs text-ink-muted">
                  יתרה: {formatILS(card.balance, 0)}
                  {" · "}
                  תפג: {formatDateHe(card.expiryDate, { day: "2-digit", month: "short", year: "numeric" })}
                </p>
              </div>

              {/* Restore button */}
              <button
                onClick={() => handleRestore(card.id)}
                disabled={restoringId === card.id}
                className="inline-flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-medium text-brand-700 bg-brand-50 hover:bg-brand-100 transition-colors disabled:opacity-50"
              >
                <RotateCcw size={13} className={restoringId === card.id ? "animate-spin" : ""} />
                שחזר
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
