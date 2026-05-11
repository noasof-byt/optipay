"use client";

import { useState } from "react";
import { useRouter }   from "next/navigation";
import {
  User, Bell, Shield, Trash2, ChevronLeft,
  Accessibility, LogOut, HelpCircle, Users,
} from "lucide-react";
import { Button }   from "@/components/ui/Button";
import { useAuth }  from "@/hooks/useAuth";
import { toast }    from "@/hooks/useToast";
import { cn }       from "@/lib/utils";

export default function ProfilePage() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting,      setDeleting]      = useState(false);
  const [pushEnabled,   setPushEnabled]   = useState(false);

  async function handlePushToggle() {
    if (!("Notification" in window)) {
      toast({ type: "warning", title: "הדפדפן לא תומך בהתראות" });
      return;
    }
    const perm = await Notification.requestPermission();
    if (perm !== "granted") {
      toast({ type: "warning", title: "הגישה להתראות נדחתה" });
      return;
    }

    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly:      true,
      applicationServerKey: process.env.NEXT_PUBLIC_VAPID_KEY,
    });

    const key  = sub.getKey("p256dh");
    const auth = sub.getKey("auth");

    await fetch("/api/push/subscribe", {
      method:  "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization:  `Bearer ${localStorage.getItem("optipay_token") ?? ""}`,
      },
      body: JSON.stringify({
        endpoint:  sub.endpoint,
        p256dhKey: key  ? btoa(String.fromCharCode(...new Uint8Array(key)))  : "",
        authKey:   auth ? btoa(String.fromCharCode(...new Uint8Array(auth))) : "",
        userAgent: navigator.userAgent,
      }),
    });

    setPushEnabled(true);
    toast({ type: "success", title: "התראות הופעלו 🔔" });
  }

  async function handleDeleteAccount() {
    setDeleting(true);
    try {
      const res = await fetch("/api/auth/account", {
        method:  "DELETE",
        headers: { Authorization: `Bearer ${localStorage.getItem("optipay_token") ?? ""}` },
      });
      if (!res.ok) throw new Error((await res.json()).message);
      logout();
      router.replace("/login");
      toast({ type: "info", title: "החשבון נמחק" });
    } catch (err: any) {
      toast({ type: "error", title: "שגיאה", description: err.message });
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  function handleLogout() {
    logout();
    router.replace("/login");
  }

  const initials = (user?.displayName ?? user?.email ?? "U")
    .split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div className="page-container py-4 space-y-4">
      {/* Avatar */}
      <div className="flex flex-col items-center gap-3 py-4">
        <div className="w-20 h-20 rounded-full gradient-header flex items-center justify-center text-2xl font-extrabold text-white">
          {initials}
        </div>
        <div className="text-center">
          <p className="text-base font-bold text-ink">{user?.displayName ?? "משתמש"}</p>
          <p className="text-xs text-ink-muted">{user?.email}</p>
        </div>
      </div>

      {/* Menu sections */}
      <MenuSection title="חשבון">
        <MenuItem icon={User}   label="פרטים אישיים"  href="/profile/edit" />
        <MenuItem icon={Shield} label="שינוי סיסמה"   href="/profile/password" />
        <MenuItem icon={Users}  label="ארנק משפחתי"   href="/profile/family" />
      </MenuSection>

      <MenuSection title="הגדרות">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Bell size={18} className="text-ink-muted" />
            <span className="text-sm text-ink">התראות Push</span>
          </div>
          <button
            role="switch"
            aria-checked={pushEnabled}
            onClick={handlePushToggle}
            className={cn(
              "w-11 h-6 rounded-full transition-colors relative",
              pushEnabled ? "bg-accent-500" : "bg-surface-border"
            )}
          >
            <span className={cn(
              "absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform",
              pushEnabled ? "translate-x-0.5" : "translate-x-5"
            )} />
          </button>
        </div>
        <MenuItem icon={Accessibility} label="נגישות" href="/profile/accessibility" />
        <MenuItem icon={HelpCircle}   label="עזרה ותמיכה" href="/support" />
      </MenuSection>

      <MenuSection title="">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-4 py-3 text-right hover:bg-surface-muted transition-colors rounded-3xl"
        >
          <LogOut size={18} className="text-ink-muted" />
          <span className="text-sm text-ink">התנתקות</span>
        </button>
      </MenuSection>

      {/* Danger zone */}
      <div className="card border border-danger/30 p-4 space-y-3">
        <p className="text-sm font-bold text-danger">אזור מסוכן</p>
        {!confirmDelete ? (
          <Button
            variant="danger"
            size="sm"
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2 size={14} />
            מחיקת חשבון לצמיתות
          </Button>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-ink-muted">
              פעולה זו בלתי הפיכה. כל הנתונים, הכרטיסים והחיסכונות יימחקו לצמיתות.
            </p>
            <div className="flex gap-2">
              <Button
                variant="danger"
                size="sm"
                loading={deleting}
                onClick={handleDeleteAccount}
                className="flex-1"
              >
                מחק לצמיתות
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setConfirmDelete(false)}
                className="flex-1"
              >
                ביטול
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MenuSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card overflow-hidden">
      {title && (
        <p className="text-xs font-semibold text-ink-muted px-4 pt-3 pb-1">{title}</p>
      )}
      <div className="divide-y divide-surface-border">{children}</div>
    </div>
  );
}

function MenuItem({
  icon: Icon, label, href,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  icon: React.ComponentType<any>;
  label: string;
  href: string;
}) {
  return (
    <a
      href={href}
      className="flex items-center justify-between px-4 py-3 hover:bg-surface-muted transition-colors"
    >
      <div className="flex items-center gap-3">
        <Icon size={18} className="text-ink-muted" />
        <span className="text-sm text-ink">{label}</span>
      </div>
      <ChevronLeft size={16} className="text-ink-faint" />
    </a>
  );
}
