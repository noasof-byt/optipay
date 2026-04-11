"use client";

import { useState, useEffect } from "react";
import { Type, Zap, Contrast } from "lucide-react";
import { cn }                  from "@/lib/utils";

const STORAGE_KEY = "optipay_a11y";

interface A11ySettings {
  largeText:     boolean;
  reduceMotion:  boolean;
  highContrast:  boolean;
}

function loadSettings(): A11ySettings {
  if (typeof window === "undefined") return { largeText: false, reduceMotion: false, highContrast: false };
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
  } catch {
    return { largeText: false, reduceMotion: false, highContrast: false };
  }
}

function applySettings(s: A11ySettings) {
  const html = document.documentElement;
  html.classList.toggle("a11y-large-text",    s.largeText);
  html.classList.toggle("a11y-reduce-motion", s.reduceMotion);
  html.classList.toggle("a11y-high-contrast", s.highContrast);
}

export default function AccessibilityPage() {
  const [settings, setSettings] = useState<A11ySettings>({
    largeText:    false,
    reduceMotion: false,
    highContrast: false,
  });

  useEffect(() => {
    const saved = loadSettings();
    setSettings((prev) => ({ ...prev, ...saved }));
  }, []);

  function toggle(key: keyof A11ySettings) {
    setSettings((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      applySettings(next);
      return next;
    });
  }

  const items: { key: keyof A11ySettings; icon: React.ElementType; label: string; description: string }[] = [
    {
      key:         "largeText",
      icon:        Type,
      label:       "טקסט גדול",
      description: "מגדיל את גודל הגופן בכל האפליקציה",
    },
    {
      key:         "reduceMotion",
      icon:        Zap,
      label:       "הפחתת אנימציות",
      description: "עוצר אנימציות ומעברים בין מסכים",
    },
    {
      key:         "highContrast",
      icon:        Contrast,
      label:       "ניגודיות גבוהה",
      description: "מגביר ניגודיות לשיפור נראות",
    },
  ];

  return (
    <div className="page-container py-6 max-w-md mx-auto space-y-3">
      <div className="card overflow-hidden divide-y divide-surface-border">
        {items.map(({ key, icon: Icon, label, description }) => (
          <button
            key={key}
            role="switch"
            aria-checked={settings[key]}
            onClick={() => toggle(key)}
            className="flex items-center justify-between w-full px-4 py-4 text-right hover:bg-surface-muted transition-colors"
          >
            <div className="flex items-center gap-3">
              <Icon size={18} className="text-ink-muted shrink-0" />
              <div>
                <p className="text-sm font-medium text-ink">{label}</p>
                <p className="text-xs text-ink-muted mt-0.5">{description}</p>
              </div>
            </div>
            <Toggle on={settings[key]} />
          </button>
        ))}
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
        "relative w-11 h-6 rounded-full transition-colors shrink-0",
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
