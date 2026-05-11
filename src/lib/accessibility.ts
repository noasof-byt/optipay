export const STORAGE_KEY = "accessibility";

export interface A11ySettings {
  textSize:     "normal" | "large" | "xlarge";
  reduceMotion: boolean;
  highContrast: boolean;
  lineRelaxed:  boolean;
}

export const DEFAULTS: A11ySettings = {
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
  h.classList.remove("acc-text-large", "acc-text-xlarge");
  if (s.textSize === "large")  h.classList.add("acc-text-large");
  if (s.textSize === "xlarge") h.classList.add("acc-text-xlarge");
  h.classList.toggle("acc-high-contrast",  s.highContrast);
  h.classList.toggle("acc-line-relaxed",   s.lineRelaxed);
  h.classList.toggle("acc-reduced-motion", s.reduceMotion);
}
