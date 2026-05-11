"use client";

import { useState, useEffect, useRef } from "react";
import { Search, MapPin, ExternalLink, CheckCircle, AlertTriangle, Clock, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { getToken } from "@/hooks/useAuth";
import { toast } from "@/hooks/useToast";
import { formatILS } from "@/lib/utils";
import type { BuyingRoute } from "@/lib/search/types";

const LS_KEY = "optipay_recent_searches";
const MAX_RECENT = 5;

function loadRecent(): string[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(LS_KEY) ?? "[]"); } catch { return []; }
}

function saveRecent(query: string) {
  const prev = loadRecent().filter((q) => q !== query);
  localStorage.setItem(LS_KEY, JSON.stringify([query, ...prev].slice(0, MAX_RECENT)));
}

// ─────────────────────────────────────────────────────────────────────────────

export default function SearchPage() {
  const [query,        setQuery]        = useState("");
  const [currentStore, setCurrentStore] = useState("");
  const [loading,      setLoading]      = useState(false);
  const [routes,       setRoutes]       = useState<BuyingRoute[] | null>(null);
  const [normalized,   setNormalized]   = useState<{ canonical: string } | null>(null);
  const [recent,       setRecent]       = useState<string[]>([]);
  const [usedRouteId,  setUsedRouteId]  = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setRecent(loadRecent()); }, []);

  async function handleSearch(q = query) {
    const trimmed = q.trim();
    if (trimmed.length < 2) {
      toast({ type: "warning", title: "יש להזין לפחות 2 תווים" });
      return;
    }

    setLoading(true);
    setRoutes(null);
    setNormalized(null);
    setUsedRouteId(null);

    try {
      const res = await fetch("/api/search", {
        method:  "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization:  `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ query: trimmed, currentStore: currentStore.trim() || undefined }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "שגיאת חיפוש");

      setRoutes(data.routes ?? []);
      setNormalized(data.normalized ?? null);
      saveRecent(trimmed);
      setRecent(loadRecent());
    } catch (err: any) {
      toast({ type: "error", title: "שגיאת חיפוש", description: err.message });
    } finally {
      setLoading(false);
    }
  }

  async function handleUseRoute(route: BuyingRoute) {
    try {
      const res = await fetch("/api/wallet/use-route", {
        method:  "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization:  `Bearer ${getToken()}`,
        },
        body: JSON.stringify({
          routeId:        route.id,
          giftCardId:     route.giftCardId,
          membershipId:   route.membershipId,
          amountDeducted: route.discountAmount,
          originalPrice:  route.originalPrice,
          storeName:      route.storeName,
          productName:    route.productName,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "שגיאה");

      setUsedRouteId(route.id);
      const saved = data.savingsAmount > 0
        ? `חסכת ${formatILS(data.savingsAmount, 0)} 🎉`
        : "הרכישה נרשמה";
      toast({ type: "success", title: saved });
    } catch (err: any) {
      toast({ type: "error", title: "שגיאה", description: err.message });
    }
  }

  return (
    <div className="page-container py-4 space-y-4 max-w-lg mx-auto">

      {/* ── Search inputs ── */}
      <div className="space-y-2">
        <div className="relative">
          <Search size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-faint" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="מה אתה מחפש? (מוצר, מותג, דגם)"
            className="w-full pr-10 pl-4 py-3 rounded-2xl border border-surface-border bg-white text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-brand-400"
            dir="rtl"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint hover:text-ink"
            >
              <X size={16} />
            </button>
          )}
        </div>

        <div className="relative">
          <MapPin size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-faint" />
          <input
            type="text"
            value={currentStore}
            onChange={(e) => setCurrentStore(e.target.value)}
            placeholder="באיזה חנות אתה נמצא כרגע? (אופציונלי)"
            className="w-full pr-9 pl-4 py-2.5 rounded-2xl border border-surface-border bg-white text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-brand-400"
            dir="rtl"
          />
        </div>

        <Button
          onClick={() => handleSearch()}
          loading={loading}
          className="w-full"
        >
          <Search size={16} />
          חפש
        </Button>
      </div>

      {/* ── Recent searches (shown only when no results yet) ── */}
      {!routes && !loading && recent.length > 0 && (
        <section>
          <p className="text-xs font-semibold text-ink-muted mb-2">חיפושים אחרונים</p>
          <div className="flex flex-wrap gap-2">
            {recent.map((q) => (
              <button
                key={q}
                onClick={() => { setQuery(q); handleSearch(q); }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-muted text-xs text-ink hover:bg-surface-border transition-colors"
              >
                <Clock size={12} className="text-ink-faint" />
                {q}
              </button>
            ))}
          </div>
        </section>
      )}

      {/* ── Loading skeleton ── */}
      {loading && (
        <div className="space-y-3 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card h-36 bg-surface-muted" />
          ))}
        </div>
      )}

      {/* ── Results ── */}
      {routes !== null && !loading && (
        <>
          {normalized && (
            <p className="text-xs text-ink-muted">
              תוצאות עבור: <span className="font-semibold text-ink">{normalized.canonical}</span>
              {" · "}{routes.length} מסלולים נמצאו
            </p>
          )}

          {routes.length === 0 ? (
            <div className="flex flex-col items-center py-16 gap-3 text-center">
              <span className="text-4xl">🔍</span>
              <p className="text-sm font-bold text-ink">לא נמצאו תוצאות</p>
              <p className="text-xs text-ink-muted">נסה מונח חיפוש אחר או בדוק את האיות</p>
            </div>
          ) : (
            <div className="space-y-3">
              {routes.map((route) => (
                <RouteCard
                  key={route.id}
                  route={route}
                  used={usedRouteId === route.id}
                  onUse={handleUseRoute}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Empty state (initial) ── */}
      {!routes && !loading && recent.length === 0 && (
        <div className="flex flex-col items-center py-20 gap-3 text-center">
          <span className="text-5xl">🛍️</span>
          <p className="text-sm font-bold text-ink">מצא את המחיר הטוב ביותר</p>
          <p className="text-xs text-ink-muted max-w-[220px]">הזן שם מוצר ונמצא לך את מסלול הקנייה המשתלם ביותר</p>
        </div>
      )}
    </div>
  );
}

// ── Route card component ──────────────────────────────────────────────────────

function RouteCard({
  route, used, onUse,
}: {
  route: BuyingRoute;
  used:  boolean;
  onUse: (r: BuyingRoute) => void;
}) {
  const hasDiscount = route.discountAmount > 0;

  return (
    <div className={`card p-4 space-y-3 ${used ? "border-accent-300 bg-accent-50" : ""}`}>
      {/* Store + product */}
      <div className="flex items-start gap-3">
        {route.imageUrl ? (
          <img
            src={route.imageUrl}
            alt={route.productName}
            className="w-14 h-14 rounded-xl object-contain bg-surface-muted shrink-0"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
        ) : (
          <div className="w-14 h-14 rounded-xl bg-surface-muted shrink-0 flex items-center justify-center text-2xl">
            🛒
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-[0.7rem] text-ink-muted">{route.storeName}</p>
          <p className="text-sm font-semibold text-ink leading-snug line-clamp-2">
            {route.productName}
          </p>
        </div>
      </div>

      {/* Benefit badge */}
      {route.appliedBenefit && (
        <div className="flex items-center gap-1.5">
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[0.65rem] font-semibold bg-brand-100 text-brand-700">
            🏷️ {route.appliedBenefit}
          </span>
          {!route.canCombine && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[0.6rem] font-medium bg-warning-100 text-warning-700 border border-warning-200">
              <AlertTriangle size={10} />
              איסור כפל מבצעים
            </span>
          )}
        </div>
      )}

      {/* Price row */}
      <div className="flex items-end justify-between">
        <div>
          {hasDiscount && (
            <p className="text-xs text-ink-faint line-through">
              {formatILS(route.originalPrice, 0)}
            </p>
          )}
          <p className={`text-xl font-extrabold ${hasDiscount ? "text-accent-600" : "text-ink"}`}>
            {formatILS(route.finalPrice, 0)}
          </p>
          {hasDiscount && (
            <p className="text-xs text-accent-600 font-medium">
              חיסכון: {formatILS(route.discountAmount, 0)}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {route.productUrl && (
            <a
              href={route.productUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-medium text-brand-700 bg-brand-50 hover:bg-brand-100 transition-colors"
            >
              <ExternalLink size={13} />
              עבור לחנות
            </a>
          )}
          {used ? (
            <span className="inline-flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-semibold text-accent-700 bg-accent-100">
              <CheckCircle size={13} />
              נרשם!
            </span>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onUse(route)}
              className="text-xs"
            >
              השתמשתי בנתיב הזה
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
