"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

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

  // Don't render on auth pages — they have their own full-page layout
  if (AUTH_ROUTES.has(pathname)) return null;
  const title    = PAGE_TITLES[pathname]
    ?? (pathname.startsWith("/wallet/") ? "פרטי כרטיס" : "");

  return (
    <header
      className={cn(
        "fixed top-0 inset-x-0 z-30 h-16 flex items-center gap-2 px-4",
        "pt-[env(safe-area-inset-top)]",
        isHome
          ? "bg-transparent"
          : "bg-surface border-b border-surface-border shadow-sm"
      )}
    >
      {/* Back button on sub-pages */}
      {!isHome && (
        <button
          onClick={() => router.back()}
          className="p-2 -mr-1 rounded-2xl text-ink-muted hover:bg-surface-muted transition-colors shrink-0"
          aria-label="חזור"
        >
          <ChevronRight size={22} />
        </button>
      )}

      {/* Centre: logo on home, page title elsewhere */}
      <div className="flex-1 flex items-center justify-center">
        {isHome ? (
          <Link href="/" aria-label="OptiPay — דף הבית">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.svg" alt="OptiPay" className="h-9 w-auto" />
          </Link>
        ) : (
          <h1 className={cn("text-base font-bold text-ink", "mr-[-2rem]")}>
            {title}
          </h1>
        )}
      </div>

      {/* Notifications bell */}
      <Link
        href="/notifications"
        className={cn(
          "relative p-2 rounded-2xl transition-colors shrink-0",
          isHome ? "text-white hover:bg-white/20" : "text-ink-muted hover:bg-surface-muted"
        )}
        aria-label="התראות"
      >
        <Bell size={22} />
        <span className="absolute top-1.5 left-1.5 w-2 h-2 rounded-full bg-danger" aria-hidden="true" />
      </Link>
    </header>
  );
}
