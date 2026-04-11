"use client";

import { useEffect, useState, useCallback } from "react";
import { Bell, CheckCheck, CreditCard, AlertTriangle, Megaphone, Info } from "lucide-react";
import { Button }        from "@/components/ui/Button";
import { formatDateHe }  from "@/lib/utils";
import { getToken }      from "@/hooks/useAuth";
import { cn }            from "@/lib/utils";

interface Notif {
  id:        string;
  type:      "CARD_EXPIRING" | "MEMBERSHIP_UNUSED" | "PROMO" | "SYSTEM";
  title:     string;
  body:      string;
  isRead:    boolean;
  createdAt: string;
}

const TYPE_META = {
  CARD_EXPIRING:     { icon: CreditCard,    color: "text-warning",  bg: "bg-warning/10"  },
  MEMBERSHIP_UNUSED: { icon: AlertTriangle, color: "text-warning",  bg: "bg-warning/10"  },
  PROMO:             { icon: Megaphone,     color: "text-accent-500", bg: "bg-accent-50" },
  SYSTEM:            { icon: Info,          color: "text-brand-500",  bg: "bg-brand-50"  },
} as const;

export default function NotificationsPage() {
  const [notifs,  setNotifs]  = useState<Notif[]>([]);
  const [loading, setLoading] = useState(true);
  const [unread,  setUnread]  = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    const res  = await fetch("/api/notifications", {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    const data = await res.json();
    setNotifs(data.notifications ?? []);
    setUnread(data.unreadCount   ?? 0);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function markAllRead() {
    await fetch("/api/notifications?all=true", {
      method:  "PATCH",
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    setNotifs((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnread(0);
  }

  async function markRead(id: string) {
    await fetch(`/api/notifications?id=${id}`, {
      method:  "PATCH",
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    setNotifs((prev) => prev.map((n) => n.id === id ? { ...n, isRead: true } : n));
    setUnread((u) => Math.max(0, u - 1));
  }

  return (
    <div className="page-container py-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-ink">התראות</h1>
          {unread > 0 && (
            <p className="text-xs text-ink-muted">{unread} לא נקראו</p>
          )}
        </div>
        {unread > 0 && (
          <Button variant="ghost" size="sm" onClick={markAllRead}>
            <CheckCheck size={14} />
            סמן הכל כנקרא
          </Button>
        )}
      </div>

      {loading ? (
        <div className="space-y-3 animate-pulse">
          {[1, 2, 3].map((i) => <div key={i} className="card h-20 bg-surface-muted" />)}
        </div>
      ) : !notifs.length ? (
        <div className="flex flex-col items-center py-16 gap-3 text-center">
          <Bell size={40} className="text-ink-faint" />
          <p className="text-sm text-ink-muted">אין התראות</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifs.map((n) => {
            const meta = TYPE_META[n.type] ?? TYPE_META.SYSTEM;
            const Icon = meta.icon;
            return (
              <button
                key={n.id}
                onClick={() => !n.isRead && markRead(n.id)}
                className={cn(
                  "w-full text-right card p-4 flex items-start gap-3 transition-colors",
                  !n.isRead && "bg-brand-50 border border-brand-100",
                  n.isRead  && "opacity-70"
                )}
              >
                <span className={cn("w-9 h-9 rounded-2xl flex items-center justify-center shrink-0", meta.bg)}>
                  <Icon size={18} className={meta.color} />
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className={cn("text-sm font-semibold text-ink", !n.isRead && "font-bold")}>
                      {n.title}
                    </p>
                    {!n.isRead && (
                      <span className="w-2 h-2 rounded-full bg-brand-500 shrink-0 mt-1.5" />
                    )}
                  </div>
                  <p className="text-xs text-ink-muted mt-0.5 text-right">{n.body}</p>
                  <p className="text-[0.6rem] text-ink-faint mt-1">
                    {formatDateHe(n.createdAt, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
