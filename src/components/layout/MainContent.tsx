"use client";

import { usePathname } from "next/navigation";

const AUTH_ROUTES = new Set(["/login", "/register", "/reset-password"]);

export function MainContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <main className={`flex-1${AUTH_ROUTES.has(pathname) ? "" : " pt-16"}`}>
      {children}
    </main>
  );
}
