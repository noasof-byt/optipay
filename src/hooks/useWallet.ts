"use client";

import { useState, useEffect, useCallback } from "react";
import { getToken } from "./useAuth";
import { toast }    from "./useToast";

export interface GiftCardItem {
  id:               string;
  networkId:        string | null;
  networkName:      string | null;
  networkLogo:      string | null;
  storeSpecificName: string | null;
  cardNumberHint:   string | null;
  expiryDate:       string;
  balance:          number;
  currency:         string;
  isFavorite:       boolean;
  isArchived:       boolean;
  usageCount:       number;
  lastUsedAt:       string | null;
}

export interface MembershipItem {
  id:               string;
  clubId:           string;
  clubName:         string;
  clubLogo:         string | null;
  baseDiscount:     number;
  isPaidMembership: boolean;
  expiryDate:       string | null;
  lastUsedAt:       string | null;
}

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization:  `Bearer ${getToken()}`,
      ...(options?.headers ?? {}),
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message ?? "שגיאת שרת");
  return data as T;
}

export function useGiftCards(archived = false) {
  const [cards,   setCards]   = useState<GiftCardItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!getToken()) { setCards([]); setLoading(false); return; }
    setLoading(true);
    try {
      const data = await apiFetch<GiftCardItem[]>(
        `/api/wallet/cards?archived=${archived}`
      );
      setCards(data);
    } catch (err: any) {
      toast({ type: "error", title: "שגיאה", description: err.message });
    } finally {
      setLoading(false);
    }
  }, [archived]);

  useEffect(() => { load(); }, [load]);

  const toggleFavorite = useCallback(async (id: string, isFavorite: boolean) => {
    setCards((prev) => prev.map((c) => c.id === id ? { ...c, isFavorite } : c));
    await apiFetch(`/api/wallet/cards/${id}`, {
      method: "PATCH",
      body:   JSON.stringify({ isFavorite }),
    }).catch(() => load());
  }, [load]);

  const updateBalance = useCallback(async (id: string, balance: number) => {
    await apiFetch(`/api/wallet/cards/${id}`, {
      method: "PATCH",
      body:   JSON.stringify({ balance }),
    });
    setCards((prev) => prev.map((c) => c.id === id ? { ...c, balance } : c));
  }, []);

  const archiveCard = useCallback(async (id: string) => {
    await apiFetch(`/api/wallet/cards/${id}`, { method: "DELETE" });
    setCards((prev) => prev.filter((c) => c.id !== id));
    toast({ type: "success", title: "הכרטיס הועבר לארכיון" });
  }, []);

  const restoreCard = useCallback(async (id: string) => {
    await apiFetch(`/api/wallet/cards/${id}`, {
      method: "PATCH",
      body:   JSON.stringify({ isArchived: false }),
    });
    setCards((prev) => prev.filter((c) => c.id !== id));
    toast({ type: "success", title: "הכרטיס שוחזר לארנק" });
  }, []);

  return { cards, loading, reload: load, toggleFavorite, updateBalance, archiveCard, restoreCard };
}

export function useMemberships() {
  const [memberships, setMemberships] = useState<MembershipItem[]>([]);
  const [loading,     setLoading]     = useState(true);

  const load = useCallback(async () => {
    if (!getToken()) { setMemberships([]); setLoading(false); return; }
    setLoading(true);
    try {
      const data = await apiFetch<MembershipItem[]>("/api/wallet/memberships");
      setMemberships(data);
    } catch (err: any) {
      toast({ type: "error", title: "שגיאה", description: err.message });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const removeMembership = useCallback(async (id: string) => {
    await apiFetch(`/api/wallet/memberships/${id}`, { method: "DELETE" });
    setMemberships((prev) => prev.filter((m) => m.id !== id));
    toast({ type: "success", title: "החברות הוסרה" });
  }, []);

  return { memberships, loading, reload: load, removeMembership };
}
