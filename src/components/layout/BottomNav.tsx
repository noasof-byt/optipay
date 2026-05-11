"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search, Wallet, User } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/search",  label: "חיפוש",  icon: Search },
  { href: "/wallet",  label: "ארנק",   icon: Wallet },
  { href: "/profile", label: "פרופיל", icon: User   },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className={cn(
        "fixed bottom-0 inset-x-0 z-30",
        "bg-surface shadow-nav border-t border-surface-border",
        "pb-[env(safe-area-inset-bottom)]"
      )}
      aria-label="ניווט ראשי"
    >
      <ul className="flex items-stretch h-[4.5rem]">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5",
                  "h-full w-full transition-colors duration-150",
                  active ? "text-brand-700" : "text-ink-faint hover:text-brand-600"
                )}
                aria-current={active ? "page" : undefined}
              >
                {/* Icon pill — sky blue background when active */}
                <span
                  className={cn(
                    "flex items-center justify-center w-10 h-6 rounded-2xl transition-all duration-200",
                    active && "bg-sky-50"
                  )}
                >
                  <Icon
                    size={20}
                    strokeWidth={active ? 2.5 : 1.8}
                    className={active ? "text-sky-400" : undefined}
                    aria-hidden="true"
                  />
                </span>
                <span
                  className={cn(
                    "text-[0.6rem] font-medium leading-none",
                    active ? "text-brand-700" : "text-ink-faint"
                  )}
                >
                  {label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
