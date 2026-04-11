"use client";

import { useAuth } from "@/hooks/useAuth";

/**
 * Personalised greeting on the home page.
 * Shows the user's first name when logged in, a generic greeting otherwise.
 */
export function HomeGreeting() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <>
        <p className="text-sm font-medium opacity-80 mb-1">שלום 👋</p>
        <h1 className="text-2xl font-bold leading-tight mb-4">
          איפה כדאי לקנות היום?
        </h1>
      </>
    );
  }

  const firstName = user?.displayName?.split(" ")[0] ?? null;

  return (
    <>
      <p className="text-sm font-medium opacity-80 mb-1">
        {firstName ? `שלום, ${firstName}! 👋` : "שלום 👋"}
      </p>
      <h1 className="text-2xl font-bold leading-tight mb-4">
        {user ? "איזה מוצר נחפש היום?" : "איפה כדאי לקנות היום?"}
      </h1>
    </>
  );
}
