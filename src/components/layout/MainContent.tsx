"use client";

import { usePathname } from "next/navigation";

const AUTH_ROUTES = new Set(["/login", "/register", "/reset-password"]);

export function MainContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <main className={`flex-1${AUTH_ROUTES.has(pathname) ? "" : " pt-[calc(4rem+env(safe-area-inset-top))]"}`}>
      {children}
    </main>
  );
}
