"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CreditCard, BadgeCheck } from "lucide-react";
import { Input }   from "@/components/ui/Input";
import { Button }  from "@/components/ui/Button";
import { getToken } from "@/hooks/useAuth";
import { toast }   from "@/hooks/useToast";
import { cn }      from "@/lib/utils";

type Mode = "card" | "club";

interface Club    { id: string; name: string; baseDiscountPercentage: number; isPaidMembership: boolean; }
interface Network { id: string; name: string; }

// ── Static network list ────────────────────────────────────────────────────────
// Always shown in the dropdown. The API call enriches these with real DB UUIDs
// so the routing engine can match them against store-accepted networks.
// The `id` here is used as the option value; if it looks like a UUID it will be
// sent as `networkId`, otherwise as `networkName` so the backend upserts it.
const SUPPORTED_NETWORKS: Network[] = [
  { id: "BuyMe",     name: "BuyMe" },
  { id: "HTZone",    name: "HTZone" },
  { id: "חבר",       name: "חבר (Hever)" },
  { id: "אשמורת",    name: "אשמורת (Ashmoret)" },
  { id: "פייס פלוס", name: "פייס פלוס (Pais Plus)" },
  { id: "נופשית",    name: "נופשית (Nofeshit)" },
  { id: "מקס",       name: "מקס (Max)" },
  { id: "ישראכרט",   name: "ישראכרט (Isracard)" },
  { id: "KSP",       name: "KSP" },
  { id: "Bug",       name: "Bug" },
];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Inner component that uses useSearchParams — must be wrapped in Suspense
function AddWalletItemContent() {
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

export default function AddWalletItemPage() {
  return (
    <Suspense fallback={<div className="page-container py-4"><div className="skeleton h-10 rounded-2xl" /></div>}>
      <AddWalletItemContent />
    </Suspense>
  );
}

// ── Gift Card Form ─────────────────────────────────────────────────────────────
function AddCardForm() {
  const router = useRouter();
  // Start with the static list — the API call replaces entries with real UUIDs
  const [networks, setNetworks] = useState<Network[]>(SUPPORTED_NETWORKS);
  const [loading,  setLoading]  = useState(false);
  const [form, setForm] = useState({
    networkId:  "",
    cardNumber: "",
    expiryDate: "",
    balance:    "",
    isFavorite: false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const token = getToken();
    fetch("/api/wallet/networks", {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => r.ok ? r.json() : Promise.reject())
      .then((data: Network[]) => {
        if (Array.isArray(data) && data.length > 0) {
          // Merge: replace static entries with real DB records where names match,
          // preserve any static entries the API didn't return.
          const byName = new Map(data.map((n) => [n.name.toLowerCase(), n]));
          const merged = SUPPORTED_NETWORKS.map((s) => {
            // Try to find by display-name match (API name may differ slightly)
            const apiMatch = data.find(
              (n) =>
                n.name.toLowerCase() === s.name.toLowerCase() ||
                n.name.toLowerCase() === s.id.toLowerCase()
            );
            return apiMatch ?? s;
          });
          // Append any DB records not in the static list
          for (const n of data) {
            const alreadyPresent = merged.some(
              (m) => m.id === n.id || m.name.toLowerCase() === n.name.toLowerCase()
            );
            if (!alreadyPresent) merged.push(n);
          }
          setNetworks(merged);
        }
      })
      .catch(() => {
        // API failed — keep showing the static list, form is still functional
      });
  }, []);

  function validate() {
    const errs: Record<string, string> = {};
    // cardNumber is optional — validate format only if provided
    if (form.cardNumber.trim()) {
      if (!/^\d+$/.test(form.cardNumber)) errs.cardNumber = "ספרות בלבד";
      else if (form.cardNumber.length < 4) errs.cardNumber = "לפחות 4 ספרות";
    }

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
      // Distinguish between a real DB UUID and a static name placeholder
      const selectedId = form.networkId;
      const isRealUUID = UUID_RE.test(selectedId);

      const res = await fetch("/api/wallet/cards", {
        method:  "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({
          // Real UUID → send as networkId; name → send as networkName (backend upserts)
          networkId:   isRealUUID ? selectedId  : undefined,
          networkName: !isRealUUID && selectedId ? selectedId : undefined,
          cardNumber:  form.cardNumber.trim() || undefined,
          expiryDate:  form.expiryDate,
          balance:     parseFloat(form.balance),
          isFavorite:  form.isFavorite,
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
          {networks.map((n) => (
            <option key={n.id} value={n.id}>{n.name}</option>
          ))}
        </select>
      </div>

      <Input
        label="מספר כרטיס (אופציונלי)"
        type="text"
        inputMode="numeric"
        placeholder="4 ספרות לפחות"
        dir="ltr"
        value={form.cardNumber}
        onChange={(e) => setForm((f) => ({ ...f, cardNumber: e.target.value.replace(/\D/g, "") }))}
        error={errors.cardNumber}
        hint="לא חובה — אם הוזן, יאוחסן מוצפן ויוצגו 4 הספרות האחרונות בלבד"
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

// ── Supported clubs static list ───────────────────────────────────────────────
// Shown immediately on render. API call replaces entries with real DB UUIDs.
const SUPPORTED_CLUBS: Club[] = [
  { id: "חבר",       name: "חבר (Hever)",        baseDiscountPercentage: 10, isPaidMembership: false },
  { id: "אשמורת",    name: "אשמורת (Ashmoret)",  baseDiscountPercentage: 10, isPaidMembership: true  },
  { id: "פייס פלוס", name: "פייס פלוס (Pais Plus)", baseDiscountPercentage: 8, isPaidMembership: false },
  { id: "נופשית",    name: "נופשית (Nofeshit)",   baseDiscountPercentage: 5,  isPaidMembership: false },
  { id: "מקס",       name: "מקס (Max)",            baseDiscountPercentage: 5,  isPaidMembership: false },
  { id: "ישראכרט",   name: "ישראכרט (Isracard)",   baseDiscountPercentage: 5,  isPaidMembership: false },
];

// ── Club Form ─────────────────────────────────────────────────────────────────
function AddClubForm() {
  const router = useRouter();
  const [clubs,      setClubs]      = useState<Club[]>(SUPPORTED_CLUBS);
  const [clubId,     setClubId]     = useState("");
  const [isPaid,     setIsPaid]     = useState(false);
  const [expiryDate, setExpiryDate] = useState("");
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState("");

  useEffect(() => {
    const token = getToken();
    fetch("/api/clubs", {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => r.ok ? r.json() : Promise.reject())
      .then((data: Club[]) => {
        if (Array.isArray(data) && data.length > 0) {
          // Merge real DB records into the static list
          const merged = SUPPORTED_CLUBS.map((s) => {
            const dbMatch = data.find(
              (c) => c.name.toLowerCase() === s.name.toLowerCase() ||
                     c.name.toLowerCase() === s.id.toLowerCase()
            );
            return dbMatch ?? s;
          });
          // Append any DB clubs not in the static list
          for (const c of data) {
            const present = merged.some((m) => m.id === c.id || m.name.toLowerCase() === c.name.toLowerCase());
            if (!present) merged.push(c);
          }
          setClubs(merged);
        }
      })
      .catch(() => {}); // keep static list on error
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!clubId) { setError("נא לבחור מועדון"); return; }

    setLoading(true);
    try {
      const isRealUUID = UUID_RE.test(clubId);
      const res = await fetch("/api/wallet/memberships", {
        method:  "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({
          clubId:           isRealUUID ? clubId    : undefined,
          clubName:         !isRealUUID ? clubId   : undefined,
          isPaidMembership: isPaid,
          expiryDate:       expiryDate || undefined,
        }),
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

      <Input
        label="תאריך פקיעת חברות (אופציונלי)"
        type="date"
        dir="ltr"
        value={expiryDate}
        min={new Date().toISOString().split("T")[0]}
        onChange={(e) => setExpiryDate(e.target.value)}
        hint="קבל התראה 30 יום לפני תפוגה"
      />

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
