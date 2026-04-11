"use client";

import { useEffect } from "react";
import { getToken } from "@/hooks/useAuth";

/**
 * Auth layout — no TopBar / BottomNav.
 * Full-screen gradient background with centred card.
 * If the user is already authenticated, redirects to home.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (getToken()) {
      window.location.replace("/");
    }
  }, []);

  return (
    <div className="min-h-dvh gradient-header flex flex-col items-center justify-center px-4 py-8">
      {/* Logo */}
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-extrabold text-white tracking-tight">
          Opti<span className="text-sky-300">Pay</span>
        </h1>
        <p className="text-white/70 text-sm mt-1">חיסכון חכם בכל קנייה</p>
      </div>

      {/* Auth card */}
      <div className="w-full max-w-sm bg-surface rounded-4xl shadow-float p-6">
        {children}
      </div>
    </div>
  );
}
