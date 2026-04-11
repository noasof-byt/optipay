"use client";

import { useState, useEffect, useCallback } from "react";

export interface AuthUser {
  id:          string;
  email:       string;
  displayName: string | null;
  avatarUrl:   string | null;
  role:        string;
}

interface AuthState {
  user:    AuthUser | null;
  token:   string | null;
  loading: boolean;
}

type Listener = () => void;
const listeners = new Set<Listener>();
let state: AuthState = { user: null, token: null, loading: true };

function notify() { listeners.forEach((l) => l()); }

function loadFromStorage() {
  if (typeof window === "undefined") return;
  try {
    const token = localStorage.getItem("optipay_token");
    const raw   = localStorage.getItem("optipay_user");
    const user  = raw ? JSON.parse(raw) as AuthUser : null;
    state = { user, token, loading: false };
  } catch {
    state = { user: null, token: null, loading: false };
  }
}

export function setAuth(token: string, user: AuthUser) {
  localStorage.setItem("optipay_token", token);
  localStorage.setItem("optipay_user", JSON.stringify(user));
  state = { user, token, loading: false };
  notify();
}

export function clearAuth() {
  localStorage.removeItem("optipay_token");
  localStorage.removeItem("optipay_user");
  state = { user: null, token: null, loading: false };
  notify();
}

export function getToken(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("optipay_token") ?? "";
}

export function useAuth(): AuthState & {
  login:    (email: string, password: string) => Promise<void>;
  logout:   () => void;
  register: (displayName: string, email: string, password: string) => Promise<void>;
} {
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    loadFromStorage();
    const listener: Listener = () => forceUpdate((n) => n + 1);
    listeners.add(listener);
    notify(); // initial paint
    return () => { listeners.delete(listener); };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await fetch("/api/auth/login", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message ?? "שגיאת כניסה");
    setAuth(data.token, data.user);
  }, []);

  const register = useCallback(async (displayName: string, email: string, password: string) => {
    const res = await fetch("/api/auth/register", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ displayName, email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message ?? "שגיאת הרשמה");
    setAuth(data.token, data.user);
  }, []);

  const logout = useCallback(() => clearAuth(), []);

  return { ...state, login, logout, register };
}
