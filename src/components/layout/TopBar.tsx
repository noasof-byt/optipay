"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { getToken } from "@/hooks/useAuth";

const PAGE_TITLES: Record<string, string> = {
  "/search":               "חיפוש",
  "/wallet":               "הארנק שלי",
  "/dashboard":            "החיסכון שלי",
  "/profile":              "הפרופיל שלי",
  "/profile/edit":         "פרטים אישיים",
  "/profile/password":     "שינוי סיסמה",
  "/profile/accessibility":"נגישות",
  "/wallet/add":           "הוסף לארנק",
  "/notifications":        "התראות",
  "/support":              "תמיכה",
};

const AUTH_ROUTES = new Set(["/login", "/register", "/reset-password"]);

export function TopBar() {
  const pathname = usePathname();
  const router   = useRouter();
  const isHome   = pathname === "/";
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchUnread = useCallback(() => {
    const token = getToken();
    if (!token) return;
    fetch("/api/notifications?unreadOnly=true", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data) setUnreadCount(data.unreadCount ?? 0); })
      .catch(() => {});
  }, []);

  // Re-fetch unread count on every navigation
  useEffect(() => { fetchUnread(); }, [pathname, fetchUnread]);

  // Also update when notifications are generated from another component
  useEffect(() => {
    window.addEventListener("notificationsUpdated", fetchUnread);
    return () => window.removeEventListener("notificationsUpdated", fetchUnread);
  }, [fetchUnread]);

  if (AUTH_ROUTES.has(pathname)) return null;
  const title = PAGE_TITLES[pathname]
    ?? (pathname.startsWith("/wallet/") ? "פרטי כרטיס" : "");

  return (
    <header
      className={cn(
        "fixed top-0 inset-x-0 z-30",
        "pt-[env(safe-area-inset-top)]",
        isHome
          ? "bg-transparent"
          : "bg-surface border-b border-surface-border shadow-sm"
      )}
    >
      {/* 3-column grid ensures title is always screen-centered */}
      <div className="h-16 grid grid-cols-3 items-center px-4">

        {/* Col 1 — start (right in RTL): back button */}
        <div className="flex justify-start">
          {!isHome && (
            <button
              onClick={() => router.back()}
              className="p-2 -mr-1 rounded-2xl text-ink-muted hover:bg-surface-muted transition-colors"
              aria-label="חזור"
            >
              <ChevronRight size={22} />
            </button>
          )}
        </div>

        {/* Col 2 — center: logo on home, page title elsewhere */}
        <div className="flex items-center justify-center">
          {isHome ? (
            <Link href="/" aria-label="OptiPay — דף הבית">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.png" alt="OptiPay" className="h-9 w-auto" />
            </Link>
          ) : (
            <h1 className="text-base font-bold text-ink text-center truncate px-1">
              {title}
            </h1>
          )}
        </div>

        {/* Col 3 — end (left in RTL): notifications bell */}
        <div className="flex justify-end">
          <Link
            href="/notifications"
            className={cn(
              "relative p-2 rounded-2xl transition-colors",
              isHome ? "text-white hover:bg-white/20" : "text-ink-muted hover:bg-surface-muted"
            )}
            aria-label="התראות"
          >
            <Bell size={22} />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 left-1.5 w-2 h-2 rounded-full bg-danger" aria-hidden="true" />
            )}
          </Link>
        </div>

      </div>
    </header>
  );
}
