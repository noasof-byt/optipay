"use client";

import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface ExpiryWarningProps {
  expiryDate: Date;
  label: string;
  className?: string;
}

export function ExpiryWarning({ expiryDate, label, className }: ExpiryWarningProps) {
  const now      = Date.now();
  const expMs    = new Date(expiryDate).getTime();
  const daysLeft = Math.ceil((expMs - now) / 86_400_000);
  const expired  = daysLeft <= 0;
  const expiring = !expired && daysLeft <= 30;

  if (!expired && !expiring) return null;

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-2xl px-3 py-2 text-xs font-semibold mt-2",
        expired
          ? "bg-surface-muted text-ink-muted border border-surface-border"
          : "bg-danger-50 text-danger border border-danger-200",
        className
      )}
      role="alert"
    >
      <AlertTriangle size={14} className="shrink-0" aria-hidden="true" />
      <span>
        {expired
          ? `פג תוקף — ${label}`
          : `⚠️ פג תוקף בעוד ${daysLeft} ${daysLeft === 1 ? "יום" : "ימים"} — ${label}`}
      </span>
    </div>
  );
}
