"use client";

import { useState, useEffect, useCallback } from "react";
import { getToken } from "./useAuth";
import { toast }    from "./useToast";

export interface GiftCardItem {
  id:                  string;
  networkId:           string | null;
  networkName:         string | null;
  networkLogo:         string | null;
  storeSpecificName:   string | null;
  cardNumberHint:      string | null;
  expiryDate:          string;
  balance:             number;
  currency:            string;
  isFavorite:          boolean;
  isArchived:          boolean;
  usageCount:          number;
  lastUsedAt:          string | null;
  isShared:            boolean;
  sharedBy:            string | null;
  isSharedWithFamily:  boolean;
}

export interface MembershipItem {
  id:                  string;
  clubId:              string;
  clubName:            string;
  clubLogo:            string | null;
  baseDiscount:        number;
  isPaidMembership:    boolean;
  expiryDate:          string | null;
  lastUsedAt:          string | null;
  isShared:            boolean;
  sharedBy:            string | null;
  isSharedWithFamily:  boolean;
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
      const url = archived ? "/api/wallet/cards/archived" : "/api/wallet/cards";
      const data = await apiFetch<GiftCardItem[]>(url);
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
    const data = await apiFetch<{ autoArchived?: boolean }>(`/api/wallet/cards/${id}`, {
      method: "PATCH",
      body:   JSON.stringify({ balance }),
    });
    if (data.autoArchived) {
      setCards((prev) => prev.filter((c) => c.id !== id));
      toast({ type: "success", title: "הכרטיס הועבר לארכיון" });
    } else {
      setCards((prev) => prev.map((c) => c.id === id ? { ...c, balance } : c));
    }
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

  const toggleCardSharing = useCallback(async (id: string, isSharedWithFamily: boolean) => {
    await apiFetch(`/api/wallet/cards/${id}`, {
      method: "PATCH",
      body:   JSON.stringify({ isSharedWithFamily }),
    });
    setCards((prev) => prev.map((c) => c.id === id ? { ...c, isSharedWithFamily } : c));
    toast({
      type:  "success",
      title: isSharedWithFamily ? "הכרטיס שותף עם המשפחה" : "השיתוף הופסק",
    });
  }, []);

  return {
    cards, loading, reload: load,
    toggleFavorite, updateBalance, archiveCard, restoreCard, toggleCardSharing,
  };
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

  const toggleMembershipSharing = useCallback(async (id: string, isSharedWithFamily: boolean) => {
    await apiFetch(`/api/wallet/memberships/${id}`, {
      method: "PATCH",
      body:   JSON.stringify({ isSharedWithFamily }),
    });
    setMemberships((prev) => prev.map((m) => m.id === id ? { ...m, isSharedWithFamily } : m));
    toast({
      type:  "success",
      title: isSharedWithFamily ? "החברות שותפה עם המשפחה" : "השיתוף הופסק",
    });
  }, []);

  return { memberships, loading, reload: load, removeMembership, toggleMembershipSharing };
}
