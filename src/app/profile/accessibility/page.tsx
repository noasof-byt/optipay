"use client";

import { useState, useEffect } from "react";
import { Type, Zap, Contrast, AlignLeft } from "lucide-react";
import { cn } from "@/lib/utils";

export const STORAGE_KEY = "accessibility";

export interface A11ySettings {
  textSize:     "normal" | "large" | "xlarge";
  reduceMotion: boolean;
  highContrast: boolean;
  lineRelaxed:  boolean;
}

const DEFAULTS: A11ySettings = {
  textSize:     "normal",
  reduceMotion: false,
  highContrast: false,
  lineRelaxed:  false,
};

export function loadA11ySettings(): A11ySettings {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
    return { ...DEFAULTS, ...saved };
  } catch {
    return DEFAULTS;
  }
}

export function applyA11ySettings(s: A11ySettings) {
  const h = document.documentElement;
  // Text size — mutually exclusive
  h.classList.remove("acc-text-large", "acc-text-xlarge");
  if (s.textSize === "large")  h.classList.add("acc-text-large");
  if (s.textSize === "xlarge") h.classList.add("acc-text-xlarge");
  // Boolean toggles
  h.classList.toggle("acc-high-contrast",  s.highContrast);
  h.classList.toggle("acc-line-relaxed",   s.lineRelaxed);
  h.classList.toggle("acc-reduced-motion", s.reduceMotion);
}

// ─────────────────────────────────────────────────────────────────────────────

export default function AccessibilityPage() {
  const [settings, setSettings] = useState<A11ySettings>(DEFAULTS);

  useEffect(() => {
    const saved = loadA11ySettings();
    setSettings(saved);
    applyA11ySettings(saved);
  }, []);

  function update(patch: Partial<A11ySettings>) {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      applyA11ySettings(next);
      return next;
    });
  }

  function cycleTextSize() {
    const sizes: A11ySettings["textSize"][] = ["normal", "large", "xlarge"];
    const next = sizes[(sizes.indexOf(settings.textSize) + 1) % sizes.length];
    update({ textSize: next });
  }

  const textSizeLabel = {
    normal: "רגיל",
    large:  "גדול (1.2×)",
    xlarge: "גדול מאוד (1.4×)",
  }[settings.textSize];

  const textSizeActive = settings.textSize !== "normal";

  return (
    <div className="page-container py-6 max-w-md mx-auto space-y-3">
      <div className="card overflow-hidden divide-y divide-surface-border">

        {/* ── Text size — 3-state cycle ── */}
        <button
          role="button"
          aria-label={`גודל טקסט: ${textSizeLabel}`}
          onClick={cycleTextSize}
          className={cn(
            "flex items-center justify-between w-full px-4 py-4 text-right transition-colors",
            textSizeActive ? "bg-brand-50" : "hover:bg-surface-muted"
          )}
        >
          <div className="flex items-center gap-3">
            <Type
              size={18}
              className={cn("shrink-0", textSizeActive ? "text-brand-700" : "text-ink-muted")}
            />
            <div>
              <p className={cn("text-sm font-medium", textSizeActive ? "text-brand-700" : "text-ink")}>
                גודל טקסט
              </p>
              <p className="text-xs text-ink-muted mt-0.5">{textSizeLabel}</p>
            </div>
          </div>
          {/* 3-dot indicator */}
          <div className="flex gap-1.5 shrink-0">
            {(["normal", "large", "xlarge"] as const).map((s) => (
              <span
                key={s}
                className={cn(
                  "w-2.5 h-2.5 rounded-full transition-colors",
                  settings.textSize === s ? "bg-brand-700" : "bg-surface-border"
                )}
              />
            ))}
          </div>
        </button>

        {/* ── High contrast ── */}
        <button
          role="switch"
          aria-checked={settings.highContrast}
          onClick={() => update({ highContrast: !settings.highContrast })}
          className={cn(
            "flex items-center justify-between w-full px-4 py-4 text-right transition-colors",
            settings.highContrast ? "bg-brand-50" : "hover:bg-surface-muted"
          )}
        >
          <div className="flex items-center gap-3">
            <Contrast
              size={18}
              className={cn("shrink-0", settings.highContrast ? "text-brand-700" : "text-ink-muted")}
            />
            <div>
              <p className={cn("text-sm font-medium", settings.highContrast ? "text-brand-700" : "text-ink")}>
                ניגודיות גבוהה
              </p>
              <p className="text-xs text-ink-muted mt-0.5">מגביר ניגודיות לשיפור נראות</p>
            </div>
          </div>
          <Toggle on={settings.highContrast} />
        </button>

        {/* ── Line spacing ── */}
        <button
          role="switch"
          aria-checked={settings.lineRelaxed}
          onClick={() => update({ lineRelaxed: !settings.lineRelaxed })}
          className={cn(
            "flex items-center justify-between w-full px-4 py-4 text-right transition-colors",
            settings.lineRelaxed ? "bg-brand-50" : "hover:bg-surface-muted"
          )}
        >
          <div className="flex items-center gap-3">
            <AlignLeft
              size={18}
              className={cn("shrink-0", settings.lineRelaxed ? "text-brand-700" : "text-ink-muted")}
            />
            <div>
              <p className={cn("text-sm font-medium", settings.lineRelaxed ? "text-brand-700" : "text-ink")}>
                מרווח שורות
              </p>
              <p className="text-xs text-ink-muted mt-0.5">מגדיל רווח בין שורות לקריאות טובה יותר</p>
            </div>
          </div>
          <Toggle on={settings.lineRelaxed} />
        </button>

        {/* ── Reduce motion ── */}
        <button
          role="switch"
          aria-checked={settings.reduceMotion}
          onClick={() => update({ reduceMotion: !settings.reduceMotion })}
          className={cn(
            "flex items-center justify-between w-full px-4 py-4 text-right transition-colors",
            settings.reduceMotion ? "bg-brand-50" : "hover:bg-surface-muted"
          )}
        >
          <div className="flex items-center gap-3">
            <Zap
              size={18}
              className={cn("shrink-0", settings.reduceMotion ? "text-brand-700" : "text-ink-muted")}
            />
            <div>
              <p className={cn("text-sm font-medium", settings.reduceMotion ? "text-brand-700" : "text-ink")}>
                הפחתת אנימציות
              </p>
              <p className="text-xs text-ink-muted mt-0.5">עוצר אנימציות ומעברים</p>
            </div>
          </div>
          <Toggle on={settings.reduceMotion} />
        </button>

      </div>

      <p className="text-xs text-ink-faint text-center px-4">
        ההגדרות נשמרות במכשיר זה בלבד
      </p>
    </div>
  );
}

function Toggle({ on }: { on: boolean }) {
  return (
    <div
      className={cn(
        "relative w-11 h-6 rounded-full transition-colors duration-200 shrink-0",
        on ? "bg-brand-700" : "bg-surface-border"
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200",
          on ? "translate-x-0.5" : "translate-x-5"
        )}
      />
    </div>
  );
}
