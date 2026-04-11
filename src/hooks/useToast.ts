/**
 * Minimal global toast store (no external state library needed).
 * Usage:  const { toast } = useToastStore()
 *         toast({ type: "success", title: "נשמר!", description: "הכרטיס נוסף לארנק" })
 */

import { useState, useEffect } from "react";

export type ToastType = "success" | "error" | "warning" | "info";

export interface ToastItem {
  id: string;
  type: ToastType;
  title?: string;
  description?: string;
  open: boolean;
}

type Listener = () => void;

// Module-level state so it's shared across all hook instances
let toasts: ToastItem[] = [];
const listeners = new Set<Listener>();

function notify() {
  listeners.forEach((l) => l());
}

function addToast(item: Omit<ToastItem, "id" | "open">) {
  const id = Math.random().toString(36).slice(2);
  toasts = [...toasts, { ...item, id, open: true }];
  notify();
  // Auto-dismiss after 4 seconds
  setTimeout(() => dismissToast(id), 4000);
}

function dismissToast(id: string) {
  toasts = toasts.map((t) => (t.id === id ? { ...t, open: false } : t));
  notify();
  // Remove from array after animation
  setTimeout(() => {
    toasts = toasts.filter((t) => t.id !== id);
    notify();
  }, 300);
}

// Singleton exported helper (can be called outside React components)
export const toast = (item: Omit<ToastItem, "id" | "open">) => addToast(item);

export function useToastStore() {
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    const listener: Listener = () => forceUpdate((n) => n + 1);
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }, []);

  return {
    toasts,
    toast: addToast,
    dismiss: dismissToast,
  };
}
