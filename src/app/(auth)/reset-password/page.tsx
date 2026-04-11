"use client";

import { useState } from "react";
import Link from "next/link";
import { Mail, CheckCircle2 } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { toast } from "@/hooks/useToast";

export default function ResetPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent]   = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError]  = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !/^\S+@\S+\.\S+$/.test(email)) {
      setError("נא להזין כתובת דוא\"ל תקינה");
      return;
    }

    setLoading(true);
    try {
      await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      // Always show success (don't leak whether email exists)
      setSent(true);
    } catch {
      toast({ type: "error", title: "שגיאה", description: "אירעה שגיאה. נסה שוב." });
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="text-center space-y-4">
        <CheckCircle2 size={48} className="text-accent-500 mx-auto" />
        <h2 className="text-lg font-bold text-ink">הוראות נשלחו!</h2>
        <p className="text-sm text-ink-muted">
          אם הכתובת קיימת במערכת, תקבל מייל עם הוראות לאיפוס הסיסמה תוך מספר דקות.
        </p>
        <Link href="/login" className="block text-brand-500 text-sm font-semibold hover:underline mt-4">
          חזור לכניסה
        </Link>
      </div>
    );
  }

  return (
    <>
      <h2 className="text-xl font-bold text-ink mb-2 text-center">איפוס סיסמה</h2>
      <p className="text-sm text-ink-muted text-center mb-6">
        הזן את כתובת הדוא״ל שלך ונשלח לך הוראות לאיפוס הסיסמה
      </p>

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <Input
          type="email"
          label="דוא״ל"
          placeholder="name@example.com"
          autoComplete="email"
          dir="ltr"
          value={email}
          onChange={(e) => { setEmail(e.target.value); setError(""); }}
          error={error}
          startIcon={<Mail size={16} />}
        />

        <Button type="submit" className="w-full" loading={loading}>
          שלח הוראות
        </Button>
      </form>

      <p className="text-center text-sm text-ink-muted mt-6">
        <Link href="/login" className="text-brand-500 font-semibold hover:underline">
          חזור לכניסה
        </Link>
      </p>
    </>
  );
}
