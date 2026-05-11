"use client";

import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { BottomNav } from "@/components/layout/BottomNav";
import { TopBar } from "@/components/layout/TopBar";

/**
 * Client-side shell that:
 * 1. Reads auth state from localStorage (via useAuth)
 * 2. Renders TopBar always, BottomNav only when authenticated
 * 3. Registers the PWA service worker once on mount
 */
export function AuthShell() {
  const { user } = useAuth();

  // Register service worker
  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw-custom.js", { scope: "/" })
        .catch((err) => console.warn("SW registration failed:", err));
    }
  }, []);

  return (
    <>
      <TopBar />
      {user && <BottomNav />}
    </>
  );
}
