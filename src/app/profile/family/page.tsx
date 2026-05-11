"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Users, UserPlus, LogOut, Crown, Mail } from "lucide-react";
import { Button }   from "@/components/ui/Button";
import { getToken } from "@/hooks/useAuth";
import { toast }    from "@/hooks/useToast";

interface Member {
  id:          string;
  displayName: string;
  email:       string;
  avatarUrl:   string | null;
  role:        string;
  isMe:        boolean;
}

interface SharedItem {
  id:       string;
  itemType: string;
  label:    string;
}

interface FamilyGroup {
  id:          string;
  name:        string;
  isOwner:     boolean;
  members:     Member[];
  sharedItems: SharedItem[];
}

export default function FamilyPage() {
  const router = useRouter();
  const [group,       setGroup]       = useState<FamilyGroup | null | undefined>(undefined); // undefined = loading
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting,    setInviting]    = useState(false);
  const [leaving,     setLeaving]     = useState(false);

  useEffect(() => {
    fetch("/api/family/group", {
      headers: { Authorization: `Bearer ${getToken()}` },
    })
      .then(async (r) => {
        if (!r.ok) { setGroup(null); return; }
        setGroup(await r.json());
      })
      .catch(() => setGroup(null));
  }, []);

  async function handleInvite() {
    const email = inviteEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast({ type: "warning", title: "כתובת אימייל לא תקינה" });
      return;
    }
    setInviting(true);
    try {
      const res = await fetch("/api/family/invite", {
        method:  "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body:    JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "שגיאה");
      toast({ type: "success", title: data.message });
      setInviteEmail("");
      // Reload group data
      const groupRes = await fetch("/api/family/group", {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (groupRes.ok) setGroup(await groupRes.json());
    } catch (err: any) {
      toast({ type: "error", title: "שגיאה", description: err.message });
    } finally {
      setInviting(false);
    }
  }

  async function handleLeave() {
    if (!confirm("האם לעזוב את הקבוצה המשפחתית?")) return;
    setLeaving(true);
    try {
      const res = await fetch("/api/family/group", {
        method:  "DELETE",
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) throw new Error((await res.json()).message);
      toast({ type: "info", title: "עזבת את הקבוצה" });
      setGroup(null);
    } catch (err: any) {
      toast({ type: "error", title: "שגיאה", description: err.message });
    } finally {
      setLeaving(false);
    }
  }

  const isLoading = group === undefined;

  return (
    <div className="page-container py-4 space-y-4">

      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="p-2 rounded-2xl text-ink-faint hover:bg-surface-muted transition-colors"
          aria-label="חזור"
        >
          <ArrowRight size={20} />
        </button>
        <div>
          <h1 className="text-lg font-bold text-ink">ארנק משפחתי</h1>
          <p className="text-xs text-ink-muted">שתף יתרות וחברויות עם בני המשפחה</p>
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="space-y-3 animate-pulse">
          {[1, 2].map((i) => <div key={i} className="card h-24 bg-surface-muted" />)}
        </div>
      )}

      {/* No group — invite to create / join */}
      {!isLoading && !group && (
        <div className="space-y-4">
          <div className="card p-5 flex flex-col items-center gap-3 text-center">
            <div className="w-16 h-16 rounded-full bg-brand-50 flex items-center justify-center">
              <Users size={28} className="text-brand-600" />
            </div>
            <h3 className="text-sm font-bold text-ink">אין לך קבוצה משפחתית</h3>
            <p className="text-xs text-ink-muted max-w-[220px]">
              הזמן בן/בת משפחה לפי אימייל ויצירת הקבוצה תתבצע אוטומטית
            </p>
          </div>

          <InviteForm
            email={inviteEmail}
            onChange={setInviteEmail}
            onSubmit={handleInvite}
            loading={inviting}
          />
        </div>
      )}

      {/* Has group */}
      {!isLoading && group && (
        <div className="space-y-4">

          {/* Group name */}
          <div className="card p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full gradient-header flex items-center justify-center">
              <Users size={18} className="text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-ink">{group.name}</p>
              <p className="text-xs text-ink-muted">{group.members.length} חברים</p>
            </div>
          </div>

          {/* Members list */}
          <div className="card overflow-hidden">
            <p className="text-xs font-semibold text-ink-muted px-4 pt-3 pb-1">חברי הקבוצה</p>
            <div className="divide-y divide-surface-border">
              {group.members.map((m) => (
                <div key={m.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="w-9 h-9 rounded-full bg-brand-100 flex items-center justify-center text-sm font-bold text-brand-700 shrink-0">
                    {(m.displayName[0] ?? "?").toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-ink truncate">
                      {m.displayName}
                      {m.isMe && <span className="text-xs text-ink-faint font-normal"> (אני)</span>}
                    </p>
                    <p className="text-xs text-ink-muted truncate">{m.email}</p>
                  </div>
                  {m.role === "OWNER" && (
                    <Crown size={14} className="text-warning-500 shrink-0" aria-label="בעלים" />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Shared items */}
          {group.sharedItems.length > 0 && (
            <div className="card overflow-hidden">
              <p className="text-xs font-semibold text-ink-muted px-4 pt-3 pb-1">פריטים משותפים</p>
              <div className="divide-y divide-surface-border">
                {group.sharedItems.map((item) => (
                  <div key={item.id} className="flex items-center gap-2 px-4 py-3">
                    <span className="text-base">{item.itemType === "GIFT_CARD" ? "💳" : "🏷️"}</span>
                    <span className="text-sm text-ink">{item.label}</span>
                    <span className="mr-auto text-[0.65rem] font-bold px-2 py-0.5 rounded-full bg-brand-50 text-brand-700">
                      👨‍👩‍👧 משפחתי
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Invite more */}
          {group.isOwner && (
            <InviteForm
              email={inviteEmail}
              onChange={setInviteEmail}
              onSubmit={handleInvite}
              loading={inviting}
            />
          )}

          {/* Leave / disband */}
          <button
            onClick={handleLeave}
            disabled={leaving}
            className="flex items-center gap-2 w-full px-4 py-3 rounded-2xl border border-danger/30 text-danger text-sm font-medium hover:bg-danger-50 transition-colors disabled:opacity-50"
          >
            <LogOut size={16} />
            {group.isOwner ? "פרק את הקבוצה" : "עזוב את הקבוצה"}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Invite form component ─────────────────────────────────────────────────────

function InviteForm({
  email, onChange, onSubmit, loading,
}: {
  email:    string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  loading:  boolean;
}) {
  return (
    <div className="card p-4 space-y-3">
      <p className="text-xs font-semibold text-ink-muted">הזמן בן/בת משפחה</p>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Mail size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-faint" />
          <input
            type="email"
            value={email}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onSubmit()}
            placeholder="כתובת אימייל"
            className="input pr-9 py-2.5 text-sm"
            dir="ltr"
          />
        </div>
        <Button
          size="sm"
          onClick={onSubmit}
          loading={loading}
          disabled={!email.trim()}
        >
          <UserPlus size={15} />
          הזמן
        </Button>
      </div>
    </div>
  );
}
