import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge Tailwind classes safely (handles conflicts). */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format a number as Israeli Shekels (₪). */
export function formatILS(amount: number, fractionDigits = 2): string {
  return new Intl.NumberFormat("he-IL", {
    style: "currency",
    currency: "ILS",
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(amount);
}

/** Format a date in Hebrew locale. */
export function formatDateHe(
  date: Date | string,
  options: Intl.DateTimeFormatOptions = { day: "2-digit", month: "long", year: "numeric" }
): string {
  return new Intl.DateTimeFormat("he-IL", options).format(new Date(date));
}

/** Returns true if the date is within `days` days from now. */
export function isExpiringSoon(date: Date | string, days = 30): boolean {
  const ms = new Date(date).getTime() - Date.now();
  return ms > 0 && ms < days * 24 * 60 * 60 * 1000;
}

/** Returns true if date is in the past. */
export function isExpired(date: Date | string): boolean {
  return new Date(date).getTime() < Date.now();
}

/** Mask a card number — show only last 4 digits. */
export function maskCardNumber(hint: string): string {
  return `•••• ${hint}`;
}

/** Compute savings percentage. */
export function savingsPercent(original: number, final: number): number {
  if (original <= 0) return 0;
  return Math.round(((original - final) / original) * 100);
}
