"use client";

/**
 * Offline fallback page — served by the service worker when the user
 * is offline and the requested page is not in cache.
 */
export default function OfflinePage() {
  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-8 text-center">
      <div className="w-24 h-24 rounded-full bg-brand-100 flex items-center justify-center mb-6">
        <span className="text-5xl">📡</span>
      </div>
      <h1 className="text-xl font-bold text-ink mb-2">אין חיבור לאינטרנט</h1>
      <p className="text-sm text-ink-muted mb-8 max-w-xs">
        נראה שאין חיבור לרשת. תוכל לצפות בארנק השמור שלך, אבל לא ניתן לבצע חיפושים בזמן אמת.
      </p>
      <button
        onClick={() => window.location.reload()}
        className="btn-primary"
      >
        נסה שוב
      </button>
    </div>
  );
}
