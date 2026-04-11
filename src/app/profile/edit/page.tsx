"use client";

import { useState, useEffect } from "react";
import { useRouter }           from "next/navigation";
import { Mail, User }          from "lucide-react";
import { Input }               from "@/components/ui/Input";
import { Button }              from "@/components/ui/Button";
import { useAuth, setAuth }    from "@/hooks/useAuth";
import { toast }               from "@/hooks/useToast";

export default function EditProfilePage() {
  const router          = useRouter();
  const { user, token } = useAuth() as ReturnType<typeof useAuth> & { token: string | null };
  const [displayName, setDisplayName] = useState("");
  const [email,       setEmail]       = useState("");
  const [loading,     setLoading]     = useState(false);
  const [errors,      setErrors]      = useState<{ displayName?: string; email?: string }>({});

  // Pre-fill once the auth state is ready
  useEffect(() => {
    if (user) {
      setDisplayName(user.displayName ?? "");
      setEmail(user.email);
    }
  }, [user]);

  function validate() {
    const errs: typeof errors = {};
    if (!displayName.trim()) errs.displayName = "שם תצוגה לא יכול להיות ריק";
    if (!email.trim() || !/^\S+@\S+\.\S+$/.test(email)) errs.email = "כתובת דוא״ל לא תקינה";
    return errs;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }

    const changed: Record<string, string> = {};
    if (displayName.trim() !== (user?.displayName ?? "")) changed.displayName = displayName.trim();
    if (email.trim().toLowerCase() !== user?.email.toLowerCase()) changed.email = email.trim();

    if (!Object.keys(changed).length) {
      toast({ type: "info", title: "לא בוצעו שינויים" });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/profile", {
        method:  "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization:  `Bearer ${localStorage.getItem("optipay_token") ?? ""}`,
        },
        body: JSON.stringify(changed),
      });

      const data = await res.json();
      if (!res.ok) {
        toast({ type: "error", title: "שגיאה", description: data.message });
        return;
      }

      // Update in-memory auth state
      const currentToken = localStorage.getItem("optipay_token") ?? "";
      setAuth(currentToken, data.user);
      toast({ type: "success", title: "הפרופיל עודכן בהצלחה ✓" });
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
          label="שם תצוגה"
          placeholder="ישראל ישראלי"
          autoComplete="name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          error={errors.displayName}
          startIcon={<User size={16} />}
        />

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

        <Button type="submit" className="w-full mt-2" loading={loading}>
          שמור שינויים
        </Button>
      </form>
    </div>
  );
}
