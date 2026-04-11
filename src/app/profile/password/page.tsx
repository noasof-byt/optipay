"use client";

import { useState }   from "react";
import { useRouter }  from "next/navigation";
import { Lock }       from "lucide-react";
import { Input }      from "@/components/ui/Input";
import { Button }     from "@/components/ui/Button";
import { toast }      from "@/hooks/useToast";

export default function ChangePasswordPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    currentPassword: "",
    newPassword:     "",
    confirmPassword: "",
  });
  const [errors,  setErrors]  = useState<Partial<typeof form>>({});
  const [loading, setLoading] = useState(false);

  function update(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  function validate() {
    const errs: Partial<typeof form> = {};
    if (!form.currentPassword) errs.currentPassword = "יש להזין את הסיסמה הנוכחית";
    if (form.newPassword.length < 8) errs.newPassword = "הסיסמה החדשה חייבת לכלול לפחות 8 תווים";
    if (form.newPassword !== form.confirmPassword) errs.confirmPassword = "הסיסמאות אינן תואמות";
    return errs;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setLoading(true);
    try {
      const res = await fetch("/api/profile/password", {
        method:  "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization:  `Bearer ${localStorage.getItem("optipay_token") ?? ""}`,
        },
        body: JSON.stringify({
          currentPassword: form.currentPassword,
          newPassword:     form.newPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (res.status === 400 && data.message?.includes("נוכחית")) {
          setErrors({ currentPassword: data.message });
        } else {
          toast({ type: "error", title: "שגיאה", description: data.message });
        }
        return;
      }

      toast({ type: "success", title: "הסיסמה עודכנה בהצלחה ✓" });
      router.back();
    } catch {
      toast({ type: "error", title: "שגיאת רשת", description: "נסה שוב" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page-container py-6 max-w-md mx-auto">
      <form onSubmit={handleSubmit} noValidate className="card p-5 space-y-4">
        <Input
          type="password"
          label="סיסמה נוכחית"
          placeholder="הזן את הסיסמה הנוכחית"
          autoComplete="current-password"
          value={form.currentPassword}
          onChange={update("currentPassword")}
          error={errors.currentPassword}
          startIcon={<Lock size={16} />}
        />

        <div className="border-t border-surface-border pt-4 space-y-4">
          <Input
            type="password"
            label="סיסמה חדשה"
            placeholder="לפחות 8 תווים"
            autoComplete="new-password"
            value={form.newPassword}
            onChange={update("newPassword")}
            error={errors.newPassword}
            startIcon={<Lock size={16} />}
          />

          <Input
            type="password"
            label="אימות סיסמה חדשה"
            placeholder="הזן שוב את הסיסמה החדשה"
            autoComplete="new-password"
            value={form.confirmPassword}
            onChange={update("confirmPassword")}
            error={errors.confirmPassword}
            startIcon={<Lock size={16} />}
          />
        </div>

        <PasswordStrength password={form.newPassword} />

        <Button type="submit" className="w-full mt-2" loading={loading}>
          עדכן סיסמה
        </Button>
      </form>
    </div>
  );
}

function PasswordStrength({ password }: { password: string }) {
  if (!password) return null;

  const checks = [
    { label: "לפחות 8 תווים",      ok: password.length >= 8 },
    { label: "אות גדולה (A–Z)",    ok: /[A-Z]/.test(password) },
    { label: "ספרה (0–9)",         ok: /[0-9]/.test(password) },
    { label: "תו מיוחד (!@#...)",  ok: /[^A-Za-z0-9]/.test(password) },
  ];

  const score   = checks.filter((c) => c.ok).length;
  const labels  = ["חלשה", "בסיסית", "סבירה", "חזקה", "חזקה מאוד"];
  const colours = ["bg-red-400", "bg-orange-400", "bg-yellow-400", "bg-accent-500", "bg-accent-600"];

  return (
    <div className="space-y-2">
      <div className="flex gap-1">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full transition-colors ${
              i < score ? colours[score - 1] : "bg-surface-border"
            }`}
          />
        ))}
      </div>
      <p className="text-xs text-ink-muted">
        חוזק: <span className="font-medium text-ink">{labels[score] ?? labels[0]}</span>
      </p>
      <ul className="space-y-0.5">
        {checks.map((c) => (
          <li key={c.label} className={`text-xs flex items-center gap-1.5 ${c.ok ? "text-accent-600" : "text-ink-faint"}`}>
            <span>{c.ok ? "✓" : "○"}</span>
            {c.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
