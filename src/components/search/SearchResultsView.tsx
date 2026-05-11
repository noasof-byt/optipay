"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, RefreshCw, LogIn } from "lucide-react";
import { BuyingRouteCard } from "./BuyingRouteCard";
import { Button } from "@/components/ui/Button";
import { SearchResponse, BuyingRoute } from "@/types/search";
import { toast } from "@/hooks/useToast";
import { getToken } from "@/hooks/useAuth";

interface Props {
  query: string;
}

type Status = "loading" | "success" | "error";

export function SearchResultsView({ query }: Props) {
  const router = useRouter();
  const [status,   setStatus]   = useState<Status>("loading");
  const [data,     setData]     = useState<SearchResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [needsAuth, setNeedsAuth] = useState(false);

  const fetchResults = useCallback(async () => {
    setStatus("loading");
    setErrorMsg("");
    setNeedsAuth(false);

    const token = getToken();
    if (!token) {
      setNeedsAuth(true);
      setStatus("error");
      return;
    }

    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.status === 401) {
        setNeedsAuth(true);
        setStatus("error");
        return;
      }

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message ?? "שגיאת שרת");
      }

      const json: SearchResponse = await res.json();
      setData(json);
      setStatus("success");

      if (json.errors.length) {
        toast({
          type:        "warning",
          title:       "חלק מהאתרים לא הגיבו",
          description: `${json.errors.length} אתרים לא הגיבו — התוצאות עשויות להיות חלקיות`,
        });
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "שגיאה לא ידועה");
      setStatus("error");
    }
  }, [query]);

  useEffect(() => { fetchResults(); }, [fetchResults]);

  // ── Loading ────────────────────────────────────────────────────────────────
  if (status === "loading") {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-3 text-sm text-ink-muted py-2">
          <span className="w-4 h-4 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
          <span>מחפש...</span>
        </div>
        {[1, 2, 3].map((i) => (
          <div key={i} className="card h-32 animate-pulse bg-surface-muted" />
        ))}
      </div>
    );
  }

  // ── Error / Auth required ─────────────────────────────────────────────────
  if (status === "error") {
    if (needsAuth) {
      const loginHref = `/login?next=${encodeURIComponent("/search?q=" + query)}`;
      return (
        <div className="flex flex-col items-center py-12 text-center gap-4">
          <LogIn size={40} className="text-brand-500" />
          <p className="text-base font-semibold text-ink">נדרשת כניסה לחשבון</p>
          <p className="text-sm text-ink-muted">כדי לחפש מחירים יש להתחבר תחילה</p>
          <Button onClick={() => router.push(loginHref)}>
            כניסה לחשבון
          </Button>
        </div>
      );
    }
    return (
      <div className="flex flex-col items-center py-12 text-center gap-4">
        <AlertCircle size={40} className="text-danger" />
        <p className="text-sm text-ink-muted">{errorMsg}</p>
        <Button variant="secondary" size="sm" onClick={fetchResults}>
          <RefreshCw size={14} />
          נסה שוב
        </Button>
      </div>
    );
  }

  // ── No results ─────────────────────────────────────────────────────────────
  if (!data?.routes.length) {
    return (
      <div className="flex flex-col items-center py-12 text-center gap-3">
        <span className="text-4xl">🔍</span>
        <p className="text-base font-semibold text-ink">לא נמצאו תוצאות</p>
        <p className="text-sm text-ink-muted">
          נסה לחפש עם מילות מפתח שונות, או בדוק את האיות
        </p>
      </div>
    );
  }

  // ── Results ────────────────────────────────────────────────────────────────
  const { routes, parsedProduct, errors } = data;
  const bestRoute = routes[0];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-ink">
            {parsedProduct.brand} {parsedProduct.model}
          </h2>
          <p className="text-xs text-ink-muted">
            {routes.length} מסלולי קנייה • {new Date(data.fetchedAt).toLocaleTimeString("he-IL")}
          </p>
        </div>
        <Button variant="ghost" size="icon" onClick={fetchResults} aria-label="רענן">
          <RefreshCw size={16} />
        </Button>
      </div>

      {/* Best route banner */}
      {bestRoute.savedAmount > 0 && (
        <div className="bg-accent-50 border border-accent-200 rounded-3xl px-4 py-3 flex items-center gap-3">
          <span className="text-2xl">💰</span>
          <div>
            <p className="text-sm font-bold text-accent-700">המסלול החסכוני ביותר</p>
            <p className="text-xs text-accent-600">
              חסכון של ₪{bestRoute.savedAmount.toFixed(0)} ({bestRoute.savedPercent}%) ב{bestRoute.storeName}
            </p>
          </div>
        </div>
      )}

      {/* Route list */}
      <div className="space-y-3">
        {routes.map((route, idx) => (
          <BuyingRouteCard
            key={route.id}
            route={route}
            rank={idx + 1}
            isBest={idx === 0}
            productName={query}
          />
        ))}
      </div>
    </div>
  );
}

