"use client";

import { useState } from "react";
import Link from "next/link";
import { Mail, Lock, Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { toast } from "@/hooks/useToast";
import { setAuth } from "@/hooks/useAuth";

export default function LoginPage() {
  const [email, setEmail]         = useState("");
  const [password, setPassword]   = useState("");
  const [showPass, setShowPass]   = useState(false);
  const [loading, setLoading]     = useState(false);
  const [errors, setErrors]       = useState<{ email?: string; password?: string }>({});

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs: typeof errors = {};
    if (!email.trim())    errs.email    = "נא להזין כתובת דוא\"ל";
    if (!password.trim()) errs.password = "נא להזין סיסמה";
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 423) {
          toast({ type: "error", title: "החשבון נעול", description: data.message });
        } else {
          toast({ type: "error", title: "שגיאת כניסה", description: data.message ?? "פרטים שגויים" });
        }
        return;
      }

      setAuth(data.token, data.user);
      window.location.href = "/";
    } catch {
      toast({ type: "error", title: "שגיאה", description: "אירעה שגיאה. נסה שוב." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <h2 className="text-xl font-bold text-ink mb-6 text-center">כניסה לחשבון</h2>

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <Input
          type="email"
          label="דוא״ל"
          placeholder="name@example.com"
          autoComplete="email"
          dir="ltr"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={errors.email}
          startIcon={<Mail size={16} />}
        />

        <Input
          type={showPass ? "text" : "password"}
          label="סיסמה"
          placeholder="הזן סיסמה"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password}
          startIcon={<Lock size={16} />}
          endIcon={
            <button
              type="button"
              onClick={() => setShowPass((v) => !v)}
              className="text-ink-faint hover:text-ink transition-colors"
              aria-label={showPass ? "הסתר סיסמה" : "הצג סיסמה"}
            >
              {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          }
        />

        <div className="text-left">
          <Link
            href="/reset-password"
            className="text-xs text-brand-500 hover:underline"
          >
            שכחת סיסמה?
          </Link>
        </div>

        <Button type="submit" className="w-full mt-2" loading={loading}>
          כניסה
        </Button>
      </form>

      <p className="text-center text-sm text-ink-muted mt-6">
        אין לך חשבון?{" "}
        <Link href="/register" className="text-brand-500 font-semibold hover:underline">
          צור חשבון
        </Link>
      </p>
    </>
  );
}
