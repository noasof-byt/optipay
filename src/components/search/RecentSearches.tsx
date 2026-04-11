"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Clock, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { getToken } from "@/hooks/useAuth";

interface HistoryItem {
  id:        string;
  query:     string;
  createdAt: string;
}

// Mock shown when the user is not logged in
const MOCK_RECENT: HistoryItem[] = [
  { id: "m1", query: "אוזניות אלחוטיות", createdAt: "" },
  { id: "m2", query: "טלוויזיה 55 אינץ'", createdAt: "" },
  { id: "m3", query: "מקרר 4 דלתות",     createdAt: "" },
];

export function RecentSearches() {
  const [items,   setItems]   = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isMock,  setIsMock]  = useState(false);

  const load = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setItems(MOCK_RECENT);
      setIsMock(true);
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/search/history", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("fetch failed");
      const data: HistoryItem[] = await res.json();
      setItems(data);
      setIsMock(false);
    } catch (err) {
      console.error("[RecentSearches] fetch failed, using mock:", err);
      setItems(MOCK_RECENT);
      setIsMock(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDelete = useCallback(async (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    if (isMock) return; // no-op on mock data
    setItems((prev) => prev.filter((i) => i.id !== id));
    try {
      await fetch(`/api/search/history?id=${id}`, {
        method:  "DELETE",
        headers: { Authorization: `Bearer ${getToken()}` },
      });
    } catch {
      load(); // revert on error
    }
  }, [isMock, load]);

  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-12 rounded-2xl bg-surface-border animate-pulse" />
        ))}
      </div>
    );
  }

  if (!items.length) {
    return (
      <p className="text-sm text-ink-muted text-center py-4">
        עדיין אין חיפושים — נסה לחפש מוצר 🔍
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item.id}>
          <Link
            href={`/search?q=${encodeURIComponent(item.query)}`}
            className={cn(
              "flex items-center gap-3 px-4 py-3",
              "bg-surface rounded-2xl shadow-card",
              "hover:bg-brand-50 active:bg-brand-100 transition-colors",
              isMock && "opacity-60 pointer-events-none"
            )}
          >
            <Clock size={16} className="text-ink-faint shrink-0" />
            <span className="flex-1 text-sm text-ink">{item.query}</span>
            {!isMock && (
              <button
                type="button"
                onClick={(e) => handleDelete(e, item.id)}
                className="p-1 rounded-lg text-ink-faint hover:text-danger transition-colors"
                aria-label={`הסר ${item.query} מהיסטוריה`}
              >
                <X size={14} />
              </button>
            )}
          </Link>
        </li>
      ))}
    </ul>
  );
}
