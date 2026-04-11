"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { z } from "zod";
import { CreditCard, BadgeCheck } from "lucide-react";
import { Input }   from "@/components/ui/Input";
import { Button }  from "@/components/ui/Button";
import { getToken } from "@/hooks/useAuth";
import { toast }   from "@/hooks/useToast";
import { cn }      from "@/lib/utils";

type Mode = "card" | "club";

interface Club { id: string; name: string; baseDiscountPercentage: number; isPaidMembership: boolean; }
interface Network { id: string; name: string; }

export default function AddWalletItemPage() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<Mode>(
    searchParams.get("tab") === "club" ? "club" : "card"
  );

  return (
    <div className="page-container py-4 space-y-5">
      <h1 className="text-lg font-bold text-ink">הוסף לארנק</h1>

      {/* Mode toggle */}
      <div className="flex gap-1 bg-surface-muted rounded-2xl p-1">
        {([
          { id: "card" as Mode, label: "כרטיס מתנה", icon: CreditCard },
          { id: "club" as Mode, label: "מועדון",      icon: BadgeCheck },
        ] as const).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setMode(id)}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold py-2.5 rounded-xl transition-colors",
              mode === id
                ? "bg-white text-brand-600 shadow-sm"
                : "text-ink-muted hover:text-ink"
            )}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {mode === "card" ? <AddCardForm /> : <AddClubForm />}
    </div>
  );
}

// ── Gift Card Form ─────────────────────────────────────────────────────────────
function AddCardForm() {
  const router = useRouter();
  const [networks, setNetworks] = useState<Network[]>([]);
  const [loading,  setLoading]  = useState(false);
  const [form, setForm] = useState({
    networkId:   "",
    cardNumber:  "",
    expiryDate:  "",
    balance:     "",
    isFavorite:  false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch("/api/wallet/networks", { headers: { Authorization: `Bearer ${getToken()}` } })
      .then((r) => r.json()).then(setNetworks).catch(() => {});
  }, []);

  function validate() {
    const errs: Record<string, string> = {};
    if (!form.cardNumber.trim())       errs.cardNumber = "נא להזין מספר כרטיס";
    else if (!/^\d+$/.test(form.cardNumber)) errs.cardNumber = "ספרות בלבד";
    else if (form.cardNumber.length < 4)     errs.cardNumber = "לפחות 4 ספרות";

    if (!form.expiryDate)              errs.expiryDate = "נא לבחור תאריך תפוגה";
    else if (new Date(form.expiryDate) <= new Date()) errs.expiryDate = "התאריך חייב להיות בעתיד";

    const bal = parseFloat(form.balance);
    if (!form.balance)                 errs.balance = "נא להזין יתרה";
    else if (isNaN(bal) || bal <= 0)   errs.balance = "יתרה חייבת להיות חיובית";

    return errs;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setLoading(true);
    try {
      const res = await fetch("/api/wallet/cards", {
        method:  "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({
          networkId:  form.networkId || undefined,
          cardNumber: form.cardNumber,
          expiryDate: form.expiryDate,
          balance:    parseFloat(form.balance),
          isFavorite: form.isFavorite,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      toast({ type: "success", title: "הכרטיס נוסף לארנק 🎉" });
      router.push("/wallet");
    } catch (err: any) {
      toast({ type: "error", title: "שגיאה", description: err.message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      {/* Network selector */}
      <div>
        <label className="block text-sm font-medium text-ink mb-1.5">רשת כרטיסי מתנה</label>
        <select
          className="input"
          value={form.networkId}
          onChange={(e) => setForm((f) => ({ ...f, networkId: e.target.value }))}
        >
          <option value="">כרטיס ספציפי לחנות / אחר</option>
          {networks.map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}
        </select>
      </div>

      <Input
        label="מספר כרטיס"
        type="text"
        inputMode="numeric"
        placeholder="לפחות 4 ספרות"
        dir="ltr"
        value={form.cardNumber}
        onChange={(e) => setForm((f) => ({ ...f, cardNumber: e.target.value.replace(/\D/g, "") }))}
        error={errors.cardNumber}
        hint="יאוחסן בצורה מוצפנת — רק 4 הספרות האחרונות יוצגו"
      />

      <Input
        label="תאריך תפוגה"
        type="date"
        dir="ltr"
        value={form.expiryDate}
        min={new Date().toISOString().split("T")[0]}
        onChange={(e) => setForm((f) => ({ ...f, expiryDate: e.target.value }))}
        error={errors.expiryDate}
      />

      <Input
        label="יתרה (₪)"
        type="number"
        inputMode="decimal"
        placeholder="0.00"
        dir="ltr"
        min={0}
        step={0.01}
        value={form.balance}
        onChange={(e) => setForm((f) => ({ ...f, balance: e.target.value }))}
        error={errors.balance}
      />

      <label className="flex items-center gap-3 cursor-pointer">
        <input
          type="checkbox"
          className="w-4 h-4 rounded accent-brand-500"
          checked={form.isFavorite}
          onChange={(e) => setForm((f) => ({ ...f, isFavorite: e.target.checked }))}
        />
        <span className="text-sm text-ink">הצמד לראש הארנק (מועדף)</span>
      </label>

      <Button type="submit" className="w-full" loading={loading}>
        הוסף כרטיס
      </Button>
    </form>
  );
}

// ── Club Form ─────────────────────────────────────────────────────────────────
function AddClubForm() {
  const router = useRouter();
  const [clubs,   setClubs]   = useState<Club[]>([]);
  const [clubId,  setClubId]  = useState("");
  const [isPaid,  setIsPaid]  = useState(false);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  useEffect(() => {
    fetch("/api/clubs", { headers: { Authorization: `Bearer ${getToken()}` } })
      .then((r) => r.json()).then(setClubs).catch(() => {});
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!clubId) { setError("נא לבחור מועדון"); return; }

    setLoading(true);
    try {
      const res = await fetch("/api/wallet/memberships", {
        method:  "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ clubId, isPaidMembership: isPaid }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      toast({ type: "success", title: "המועדון נוסף לארנק 🎉" });
      router.push("/wallet?tab=memberships");
    } catch (err: any) {
      toast({ type: "error", title: "שגיאה", description: err.message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-ink mb-1.5">בחר מועדון</label>
        <select
          className={cn("input", error && "border-danger")}
          value={clubId}
          onChange={(e) => { setClubId(e.target.value); setError(""); }}
        >
          <option value="">בחר מועדון...</option>
          {clubs.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({c.baseDiscountPercentage}% הנחה)
            </option>
          ))}
        </select>
        {error && <p className="text-xs text-danger mt-1">{error}</p>}
      </div>

      <label className="flex items-center gap-3 cursor-pointer card p-4">
        <input
          type="checkbox"
          className="w-4 h-4 rounded accent-brand-500"
          checked={isPaid}
          onChange={(e) => setIsPaid(e.target.checked)}
        />
        <div>
          <p className="text-sm font-semibold text-ink">מועדון בתשלום</p>
          <p className="text-xs text-ink-muted">סמן אם אתה משלם דמי חבר שנתיים</p>
        </div>
      </label>

      <Button type="submit" className="w-full" loading={loading}>
        הוסף מועדון
      </Button>
    </form>
  );
}
