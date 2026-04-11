"use client";

import { useState } from "react";
import Link from "next/link";
import { Mail, Lock, User, Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { toast } from "@/hooks/useToast";
import { setAuth } from "@/hooks/useAuth";

export default function RegisterPage() {
  const [form, setForm] = useState({
    displayName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Partial<typeof form>>({});

  function update(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  function validate() {
    const errs: Partial<typeof form> = {};
    if (!form.displayName.trim())
      errs.displayName = "נא להזין שם תצוגה";
    if (!form.email.trim() || !/^\S+@\S+\.\S+$/.test(form.email))
      errs.email = "כתובת דוא\"ל לא תקינה";
    if (form.password.length < 8)
      errs.password = "הסיסמה חייבת לכלול לפחות 8 תווים";
    if (form.password !== form.confirmPassword)
      errs.confirmPassword = "הסיסמאות אינן תואמות";
    return errs;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: form.displayName,
          email: form.email,
          password: form.password,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast({ type: "error", title: "שגיאת הרשמה", description: data.message });
        return;
      }

      setAuth(data.token, data.user);
      toast({ type: "success", title: "ברוכים הבאים!", description: "החשבון נוצר בהצלחה" });
      window.location.href = "/";
    } catch {
      toast({ type: "error", title: "שגיאה", description: "אירעה שגיאה. נסה שוב." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <h2 className="text-xl font-bold text-ink mb-6 text-center">יצירת חשבון</h2>

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <Input
          label="שם תצוגה"
          placeholder="ישראל ישראלי"
          autoComplete="name"
          value={form.displayName}
          onChange={update("displayName")}
          error={errors.displayName}
          startIcon={<User size={16} />}
        />

        <Input
          type="email"
          label="דוא״ל"
          placeholder="name@example.com"
          autoComplete="email"
          dir="ltr"
          value={form.email}
          onChange={update("email")}
          error={errors.email}
          startIcon={<Mail size={16} />}
        />

        <Input
          type={showPass ? "text" : "password"}
          label="סיסמה"
          placeholder="לפחות 8 תווים"
          autoComplete="new-password"
          value={form.password}
          onChange={update("password")}
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

        <Input
          type={showPass ? "text" : "password"}
          label="אימות סיסמה"
          placeholder="הזן שוב את הסיסמה"
          autoComplete="new-password"
          value={form.confirmPassword}
          onChange={update("confirmPassword")}
          error={errors.confirmPassword}
          startIcon={<Lock size={16} />}
        />

        <Button type="submit" className="w-full mt-2" loading={loading}>
          צור חשבון
        </Button>
      </form>

      <p className="text-center text-sm text-ink-muted mt-6">
        כבר יש לך חשבון?{" "}
        <Link href="/login" className="text-brand-500 font-semibold hover:underline">
          כניסה
        </Link>
      </p>
    </>
  );
}
