"use client";

import { useState }                     from "react";
import { ChevronDown, Mail, MessageCircle } from "lucide-react";
import { Button }                        from "@/components/ui/Button";
import { cn }                            from "@/lib/utils";

const FAQS = [
  {
    q: "איך מוסיפים כרטיס מתנה לארנק?",
    a: "נכנסים לארנק → לוחצים על ״הוסף לארנק״ → בוחרים ״כרטיס מתנה״ ומזינים את הפרטים. הכרטיס מוצפן ומאוחסן בצורה מאובטחת.",
  },
  {
    q: "מהי כפל הנחות ולמה זה חשוב?",
    a: 'OptiPay אוכפת את כללי "אי כפל הנחות" לפי הוראות הרגולציה הישראלית. כאשר הנחת מועדון ותשלום בכרטיס מתנה אינם ניתנים לשילוב, האפליקציה תציג רק את האפשרות המשתלמת ביותר.',
  },
  {
    q: "האם המידע שלי מאובטח?",
    a: "כן. מספרי הכרטיסים מוצפנים ב-AES-256 לפני שמירה בבסיס הנתונים. אנחנו שומרים רק את 4 הספרות האחרונות לתצוגה.",
  },
  {
    q: "החיסכון המדווח — איך מחושב?",
    a: "החיסכון הוא ההפרש בין המחיר המלא בחנות לבין המחיר הסופי לאחר יישום כל ההנחות, כרטיסי המתנה, ויתרונות המועדון.",
  },
  {
    q: "מה עושים אם יתרת הכרטיס לא מעודכנת?",
    a: "ניתן לעדכן יתרה ידנית בכל עת — נכנסים לארנק → לוחצים על הכרטיס → ״ערוך יתרה״.",
  },
  {
    q: "האפליקציה תומכת באיזה חנויות?",
    a: "OptiPay מחפשת מחירים בחנויות הגדולות בישראל ומתרחבת כל הזמן. ניתן להוסיף כרטיסי מתנה מכל חנות, גם אם אינה נסרקת באופן אוטומטי.",
  },
];

export default function SupportPage() {
  const [open, setOpen] = useState<number | null>(null);

  function toggle(i: number) {
    setOpen((prev) => (prev === i ? null : i));
  }

  return (
    <div className="page-container py-6 space-y-6 max-w-lg mx-auto">

      {/* FAQ */}
      <section>
        <h2 className="section-title mb-3">שאלות נפוצות</h2>
        <div className="card overflow-hidden divide-y divide-surface-border">
          {FAQS.map((faq, i) => (
            <div key={i}>
              <button
                onClick={() => toggle(i)}
                className="flex items-center justify-between w-full px-4 py-4 text-right gap-3"
                aria-expanded={open === i}
              >
                <span className="text-sm font-medium text-ink">{faq.q}</span>
                <ChevronDown
                  size={16}
                  className={cn(
                    "text-ink-faint shrink-0 transition-transform duration-200",
                    open === i && "rotate-180"
                  )}
                />
              </button>
              {open === i && (
                <p className="px-4 pb-4 text-sm text-ink-muted leading-relaxed">
                  {faq.a}
                </p>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Contact */}
      <section>
        <h2 className="section-title mb-3">צור קשר</h2>
        <div className="card p-5 space-y-3">
          <p className="text-sm text-ink-muted">
            לא מצאת תשובה? נשמח לעזור. ניתן לפנות אלינו בכל אחד מהערוצים:
          </p>
          <div className="flex flex-col gap-2">
            <a
              href="mailto:support@optipay.co.il"
              className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-surface-muted hover:bg-surface-border transition-colors"
            >
              <Mail size={18} className="text-brand-700 shrink-0" />
              <div>
                <p className="text-sm font-medium text-ink">דוא״ל</p>
                <p className="text-xs text-ink-muted" dir="ltr">support@optipay.co.il</p>
              </div>
            </a>
            <a
              href="https://wa.me/972500000000"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-surface-muted hover:bg-surface-border transition-colors"
            >
              <MessageCircle size={18} className="text-accent-600 shrink-0" />
              <div>
                <p className="text-sm font-medium text-ink">WhatsApp</p>
                <p className="text-xs text-ink-muted">זמינים בימים א׳–ה׳, 09:00–17:00</p>
              </div>
            </a>
          </div>
        </div>
      </section>

      {/* App version */}
      <p className="text-xs text-ink-faint text-center">
        OptiPay · גרסה 1.0.0
      </p>
    </div>
  );
}
