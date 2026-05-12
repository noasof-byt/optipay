# OptiPay — מדריך טכני מקיף לבוחנים

> **מיועד ל:** סטודנטים המגישים את הפרויקט לבחינה
> **שפה:** עברית עם מונחים טכניים באנגלית כנהוג בתעשייה

---

## תוכן העניינים

1. [סקירת המוצר](#1-סקירת-המוצר)
2. [ערימת הטכנולוגיות והארכיטקטורה](#2-ערימת-הטכנולוגיות-והארכיטקטורה)
3. [החלטות עיצוב מרכזיות](#3-החלטות-עיצוב-מרכזיות)
4. [אמצעי האבטחה](#4-אמצעי-האבטחה)
5. [שאלות בוחן צפויות ותשובות](#5-שאלות-בוחן-צפויות-ותשובות)
6. [מפת ארכיטקטורת הקוד](#6-מפת-ארכיטקטורת-הקוד)

---

## 1. סקירת המוצר

### מה זה OptiPay?

OptiPay היא אפליקציית חיסכון חכמה לצרכן הישראלי. הבעיה שהיא פותרת: לצרכן ישראלי ממוצע יש כרטיסי מתנה (BuyMe, גיפטקארד, כרטיס אשראי נטען) וחברויות למועדוני קנייה (KlavBY, Shoparak, קלאב מרקט). הבעיה היא שבעת רכישה — **האם כדאי להשתמש בכרטיס מתנה? בהנחת המועדון? האם אפשר לשלב את השניים?** — החישוב הזה מסובך וצרכנים רבים פשוט מוותרים ומשלמים מחיר מלא.

OptiPay מבצעת את כל החישוב אוטומטית: המשתמש מחפש מוצר ("אייפון 15 פרו"), האפליקציה סורקת מחירים בזמן אמת מאתרי קנייה ישראלים, ולאחר מכן משווה את כל אפשרויות הרכישה — כולל שימוש בכרטיסי מתנה, הנחות מועדון, וצירוף של שניהם — ומציגה את **הדרך הזולה ביותר לשלם**.

### סוג האפליקציה

OptiPay היא **Full-Stack Progressive Web App (PWA)**:
- **Full-Stack** — קוד הצד-לקוח (React) וקוד הצד-שרת (API Routes) חיים באותו repository אחד
- **PWA** — האפליקציה מתנהגת כמו אפליקציה נייטיב: ניתן להתקין אותה על מסך הבית של הטלפון, היא עובדת גם כשאין אינטרנט (Offline), ושולחת התראות Push
- **SaaS** — כל הנתונים מאוחסנים בענן (Supabase), המשתמש מתחבר עם חשבון ויכול לגשת מכל מכשיר

### מסלול המשתמש

```
הרשמה/התחברות
       ↓
ארנק — הוספת כרטיסי מתנה וחברויות מועדון
       ↓
חיפוש מוצר בעברית או אנגלית ("iPhone 15 Pro" / "אייפון 15 פרו")
       ↓
Gemini API מנרמל את השאילתה לאנגלית קנונית
       ↓
סריקת מחירים: Bug.co.il + Google Shopping (SerpApi) בו-זמנית
       ↓
Matchmaker — חישוב כל מסלולי הרכישה האפשריים עם הארנק של המשתמש
       ↓
הצגת Top 10 תוצאות: מחיר מקורי, הנחה, מחיר סופי, מה להשתמש
       ↓
בחירת מסלול → ניכוי מיתרת כרטיס + עדכון שימוש במועדון + שמירת חיסכון
       ↓
Dashboard — סטטיסטיקת החיסכון לאורך זמן
```

---

## 2. ערימת הטכנולוגיות והארכיטקטורה

### 2.1 שפות ו-Frameworks

#### TypeScript

**מה זה:** TypeScript היא שפת תכנות שנבנתה על גבי JavaScript ומוסיפה לה מערכת **Types** (טיפוסים) סטטית. בניגוד ל-JavaScript שבה ניתן לשלוח `undefined` לפונקציה שמצפה למספר ולגלות את הבאג רק בזמן ריצה — TypeScript מגלה שגיאות כאלה **בזמן קומפילציה**, לפני שהקוד בכלל רץ.

**למה בחרנו:** עם 14 מודלים בבסיס הנתונים, עשרות API routes, ו-hooks מורכבים — TypeScript מונע טעויות כמו "קראתי שדה `savingsAmount` בעוד ש-API מחזיר `savedAmount`" (בדיוק הבאג שמצאנו בדשבורד).

**איפה מופיע בקוד:** כל קובץ בפרויקט שנגמר ב-`.ts` או `.tsx`. לדוגמה, `src/lib/search/types.ts` מגדיר את ה-interfaces המרכזיים:
```typescript
interface BuyingRoute {
  storeName: string;
  originalPrice: number;
  finalPrice: number;
  giftCardId?: string;  // TypeScript יודע שזה אופציונלי
}
```

---

#### React

**מה זה:** React היא ספרייה לבניית ממשקי משתמש. הרעיון המרכזי: ה-UI מחולק ל**Components** (רכיבים) עצמאיים שכל אחד אחראי על חלק מסוים של המסך. כשנתונים משתנים, React מעדכן אוטומטית רק את החלק הרלוונטי.

**Hooks מרכזיים בפרויקט:**
- `useState` — מצב מקומי לרכיב. לדוגמה, `const [loading, setLoading] = useState(true)` — ה-spinner מופיע כשה-loading הוא true
- `useEffect` — קוד שרץ אחרי שהרכיב מוצג. משמש לטעינת נתונים מהשרת
- `useCallback` — שומר פונקציה בזיכרון כדי שלא תיווצר מחדש בכל render. משמש ב-TopBar לפונקציית `fetchUnread`
- `useMemo` — שומר חישוב יקר בזיכרון. משמש לחישוב הכרטיסים הממוינים ב-wallet

**איפה מופיע:** כל קובץ `.tsx` בתוך `src/app/` ו-`src/components/` הוא React Component.

---

#### Next.js 14

**מה זה:** Next.js היא Framework שבנויה על React ומוסיפה לה יכולות Full-Stack. עם Next.js לא צריך שרת Express נפרד — ה-API routes חיים בתוך אותו פרויקט.

**App Router:** החל מגרסה 13, Next.js עברה ל-"App Router" שמשתמש במבנה קבצים כדי להגדיר נתיבים. קובץ ב-`src/app/wallet/page.tsx` = הדף `/wallet`. קובץ ב-`src/app/api/search/route.ts` = endpoint `/api/search`.

**Server Components vs Client Components:**
- **Server Components** (ברירת מחדל) — רצים על השרת בלבד. לא ניתן להשתמש ב-useState, אבל מהירים יותר ואינם שולחים JavaScript ל-browser
- **Client Components** — מסומנים עם `"use client"` בראש הקובץ. יש להם גישה ל-useState, event handlers, ו-browser APIs

בפרויקט: כל דפי ה-UI מסומנים `"use client"` כי הם אינטראקטיביים. ה-API routes הם תמיד Server-side.

**`export const dynamic = 'force-dynamic'`:** כל API route בפרויקט מכיל שורה זו. היא מונעת מ-Next.js לשמור את התשובה ב-cache ולשלוח נתונים ישנים למשתמשים שונים.

**איפה מופיע:** מבנה כל הפרויקט מבוסס Next.js. `next.config.js` מגדיר את הגדרות ה-PWA.

---

#### Tailwind CSS

**מה זה:** Tailwind היא framework לעיצוב CSS שמבוסס על **Utility Classes** — במקום לכתוב קובץ CSS נפרד, מוסיפים classes ישירות ל-HTML: `className="flex items-center gap-2 p-4 rounded-xl"`.

**RTL Support:** הפרויקט בנוי לעברית (RTL — Right to Left). התוספת `dir="rtl"` ב-`<html>` בשילוב עם Tailwind מאפשרת: `justify-start` = ימין, `justify-end` = שמאל.

**Responsive Design:** Classes כמו `md:grid-cols-2` = grid של 2 עמודות רק על מסכים בינוניים ומעלה.

**איפה מופיע:** בכל קובץ `.tsx` שמכיל JSX. הגדרות גלובליות ב-`src/app/globals.css`.

---

### 2.2 בסיס נתונים ו-ORM

#### PostgreSQL

**מה זה:** PostgreSQL היא **מסד נתונים רלציוני** (Relational Database). הנתונים מאורגנים בטבלאות עם שורות ועמודות, וה**יחסים** בין הטבלאות (relations) מוגדרים דרך **Foreign Keys**.

**למה רלציוני ולא MongoDB:**
- הנתונים שלנו הם מורכבים ומחוברים: `User → GiftCard → GiftCardNetwork → StoreNetwork → Store → StoreClubBenefit → Club`
- בסיס נתונים רלציוני מבטיח **ACID**:
  - **Atomicity** — עסקה (transaction) היא "הכל או כלום". אם ניכוי מכרטיס נכשל, המסד לא ישמור שינויים חלקיים
  - **Consistency** — לא ייווצרו נתונים לא תקינים (foreign key constraints)
  - **Isolation** — שני משתמשים שמנכים מאותו כרטיס בו-זמנית לא יגרמו לבאג
  - **Durability** — נתון שנכתב ל-DB יישמר גם אחרי קריסה

---

#### Supabase

**מה זה:** Supabase הוא שירות ענן שמספק **PostgreSQL מנוהל** (Managed Database). בנוסף לבסיס הנתונים, הוא מספק: ממשק גרפי לניהול הנתונים, לוחות מעקב, ו-**pgBouncer** — Connection Pooler שמנהל את ה-connections לבסיס הנתונים.

**pgBouncer:** כשיש 100 משתמשים שמבקשים בו-זמנית, לא צריח לפתוח 100 חיבורים לבסיס הנתונים. pgBouncer מנהל pool מוגבל של חיבורים ומחלק אותם בין הבקשות. ב-Supabase: פורט 6543 = pooler, פורט 5432 = direct connection.

**חשוב לפרויקט:** פקודת `prisma migrate dev` מחייבת direct connection (פורט 5432), לא דרך ה-pooler. זאת הסיבה שיש לנו `DIRECT_URL` נפרד ב-`.env`.

---

#### Prisma ORM

**מה זה ORM:** ORM (Object-Relational Mapper) הוא שכבת תוכנה שמתרגמת בין קוד TypeScript לבין שאילתות SQL. במקום לכתוב:
```sql
SELECT * FROM "gift_cards" WHERE "userId" = $1 AND "isArchived" = false
```
כותבים:
```typescript
await prisma.giftCard.findMany({ where: { userId, isArchived: false } })
```

**`schema.prisma`:** קובץ הגדרת הסכמה. כל `model` בקובץ הופך לטבלה ב-PostgreSQL. כל שדה מוגדר עם טיפוסו ואופציות נוספות.

**`prisma migrate dev`:** יצירת **Migration** — קובץ SQL שמתאר את השינויים בסכמה. פקודה זו:
1. בודקת את ההבדל בין `schema.prisma` לבין מצב DB הנוכחי
2. יוצרת קובץ migration ב-`prisma/migrations/`
3. מריצה את ה-SQL על בסיס הנתונים
4. מחזקת גרסאות — ניתן לדעת בדיוק מה שונה ומתי

**`prisma generate`:** יוצר את ה-TypeScript types מ-schema.prisma. אחרי שינוי ב-schema חייבים להריץ זאת כדי שה-TypeScript יכיר את השדות החדשים.

---

#### סכמת בסיס הנתונים — 14 מודלים

```
User ─────────────────────────────────────────────────┐
  ├── GiftCard (כרטיסי מתנה)                          │
  │     └── GiftCardNetwork (רשת הכרטיס — BuyMe וכו') │
  ├── UserClubMembership (חברויות מועדון)              │
  │     └── Club (המועדון — KlavBY וכו')               │
  ├── FamilyGroupMember → FamilyGroup                  │
  ├── SearchHistory (היסטוריית חיפושים + חיסכון)       │
  ├── Notification (התראות)                            │
  └── SupportTicket (פניות תמיכה)                      │
                                                       │
Store ────────────────────────────────────────────────┘
  ├── StoreNetwork (קשר: חנות ↔ רשת כרטיסי מתנה)
  ├── StoreClubBenefit (הנחה ספציפית של מועדון בחנות)
  └── ClubNetworkRule (האם ניתן לצרף כרטיס + מועדון?)
```

**פירוט המודלים:**

| מודל | תפקיד |
|------|--------|
| `User` | משתמש — email, passwordHash, role (USER/ADMIN/SUPPORT), isLocked |
| `UserSession` | מעקב אחרי sessions — tokenHash, userAgent, IP, תפוגה |
| `PasswordResetToken` | אסימון איפוס סיסמה חד-פעמי עם תפוגה |
| `GiftCard` | כרטיס מתנה — מספר מוצפן, יתרה, תאריך תפוגה, isFavorite, isArchived |
| `GiftCardNetwork` | רשת כרטיסים (BuyMe, גיפטקארד) — שם, לוגו |
| `UserClubMembership` | חברות במועדון — תאריך תפוגה, דמי חבר, lastUsedAt |
| `Club` | מועדון קנייה — שם, הנחה בסיסית, תאריך סריקה אחרון |
| `Store` | חנות — שם, סניפים |
| `StoreNetwork` | מפה: אילו חנויות מקבלות אילו רשתות כרטיסים |
| `StoreClubBenefit` | הנחה ספציפית של מועדון בחנות + `noDoubleDiscount` |
| `ClubNetworkRule` | כלל: האם מותר לצרף מועדון X עם רשת Y? |
| `FamilyGroup` | קבוצת משפחה (owner + members) |
| `FamilyGroupMember` | חבר בקבוצת משפחה + role (OWNER/MEMBER) |
| `SearchHistory` | כל חיפוש: מוצר, חנות, מחיר, הנחה, חיסכון בפועל |
| `Notification` | התראה: type (CARD_EXPIRING/SYSTEM), isRead, payload |
| `SupportTicket` | פנייה לתמיכה + תגובות |

---

### 2.3 אימות ואבטחה

#### JWT (JSON Web Tokens)

**מה זה:** JWT הוא **אסימון** (token) שמאפשר לשרת לאמת את זהות המשתמש בכל בקשה. הטוקן מורכב משלושה חלקים מופרדים בנקודה:

```
eyJhbGciOiJIUzI1NiJ9   ←  Header (base64): אלגוריתם חתימה
.eyJ1c2VySWQiOiIxMjMifQ  ←  Payload (base64): מזהה המשתמש + תפוגה
.SflKxwRJSMeKKF2QT4fwpMeJ  ←  Signature: חתימה עם SECRET KEY
```

**איך עובד בפרויקט:**
1. משתמש מתחבר → שרת מייצר JWT חתום עם `JWT_SECRET` (רק לשרת ידוע)
2. הטוקן נשלח ל-browser ב-**httpOnly Cookie** (לא נגיש ל-JavaScript)
3. בכל בקשה עתידית, ה-browser שולח את ה-cookie אוטומטית
4. השרת מאמת את החתימה ומחלץ את ה-userId

**קוד ב-`src/lib/auth.ts`:**
```typescript
export function signToken(payload: object): string {
  return jwt.sign(payload, process.env.JWT_SECRET!, { expiresIn: "7d" });
}
export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;
}
```

**Dual Auth:** הפרויקט מאמת גם דרך httpOnly cookie וגם דרך `Authorization: Bearer` header — כדי שגם הבקשות מה-frontend (cookie) וגם קריאות ישירות ל-API (header) יעבדו.

---

#### bcryptjs — גיבוב סיסמאות

**מה זה:** bcrypt הוא אלגוריתם לגיבוב (hashing) סיסמאות. **לעולם לא מאחסנים סיסמה בטקסט חופשי**. במקום זאת:
1. בעת הרשמה: `hash = bcrypt.hash("MyPassword123", 12)` — ה-`12` הוא מספר ה-rounds (כמה פעמים לחשב — יותר rounds = יותר זמן לתוקף)
2. ה-hash נשמר ב-DB (נראה כמו: `$2b$12$...`)
3. בעת התחברות: `bcrypt.compare("MyPassword123", hash)` — מחשב מחדש ומשווה

**למה לא MD5/SHA1:** אלגוריתמים ישנים אלה מהירים מדי — מחשב מודרני יכול לנסות מיליארדי שילובים בשנייה. bcrypt עם 12 rounds לוקח ~250ms לניסיון אחד, מה שהופך brute-force לבלתי אפשרי בפועל.

**בפרויקט:** `bcrypt.hash(password, 12)` בעת הרשמה; `bcrypt.compare(plain, hash)` בעת התחברות.

---

#### AES-256-GCM — הצפנת מספרי כרטיסים

**מה זה:** AES-256 (Advanced Encryption Standard) היא **הצפנה סימטרית** — אותו מפתח מצפין ומפענח. GCM (Galois/Counter Mode) מוסיף **Authentication Tag** שמאמת שהנתון לא שונה.

**IV (Initialization Vector):** בכל הצפנה נוצר מספר אקראי ייחודי בן 12 bytes. גם אם שני כרטיסים אחים זהים, ה-ciphertext יהיה שונה. ה-IV נשמר לצד ה-ciphertext כדי שניתן יהיה לפענח.

**פורמט הנתון שנשמר ב-DB:** `base64(IV[12 bytes] + ciphertext + authTag[16 bytes])`

**למה הצפנה ולא גיבוב:** גיבוב הוא חד-כיווני. מספר כרטיס אנחנו צריכים **לראות** (להציג למשתמש), לכן חייבים הצפנה דו-כיוונית.

**קוד ב-`src/lib/encryption.ts`:**
```typescript
export function encrypt(plain: string): string {
  const iv  = crypto.randomBytes(12);
  const key = Buffer.from(process.env.ENCRYPTION_KEY!, "hex");
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  // ... returns base64(iv + ciphertext + tag)
}
export function decrypt(ciphertext: string): string {
  // ... extracts iv, decrypts, verifies tag
}
```

---

#### Account Lockout — נעילת חשבון

**מה זה:** לאחר 5 ניסיונות התחברות כושלים, השרת מגדיר `isLocked = true` ב-User. כל ניסיון נוסף נדחה עם שגיאה `"החשבון נעול"` — גם אם הסיסמה נכונה.

**מגן מפני:** Brute Force Attack — תוקף שמנסה אוטומטית מיליוני סיסמאות. עם נעילה, לאחר 5 ניסיונות הוא נחסם לחלוטין.

**בפרויקט:** `failedLoginAttempts >= 5 → isLocked = true`. Admin יכול לפתוח דרך ה-API.

---

### 2.4 API ו-Backend

#### REST API

**מה זה:** REST (Representational State Transfer) הוא **סגנון ארכיטקטורה** לתקשורת בין client ל-server דרך HTTP. כל resource (משאב) מיוצג ב-URL, וה-HTTP method מגדיר מה עושים איתו:

| Method | פעולה | דוגמה |
|--------|--------|--------|
| `GET` | קריאת נתונים | `GET /api/wallet/cards` — קבל רשימת כרטיסים |
| `POST` | יצירת נתון חדש | `POST /api/wallet/cards` — הוסף כרטיס |
| `PATCH` | עדכון חלקי | `PATCH /api/wallet/cards/[id]` — עדכן יתרה |
| `DELETE` | מחיקה | `DELETE /api/wallet/cards/[id]` — מחק כרטיס |

**Status Codes:**
- `200 OK` — הצלחה
- `201 Created` — נוצר בהצלחה
- `400 Bad Request` — קלט לא תקין
- `401 Unauthorized` — לא מחובר
- `403 Forbidden` — מחובר אבל אין הרשאה
- `404 Not Found` — לא נמצא
- `500 Internal Server Error` — שגיאת שרת

---

#### Next.js API Routes

**מה זה:** בפרויקט Next.js, כל קובץ `route.ts` בתוך `src/app/api/` הופך ל-API endpoint. הקובץ מיצא פונקציות לפי שם ה-method:

```typescript
// src/app/api/wallet/cards/route.ts
export async function GET(req: NextRequest) { ... }
export async function POST(req: NextRequest) { ... }
```

**`export const dynamic = 'force-dynamic'`:** מונע מ-Next.js לבצע Static Generation לתשובות ה-API (שמירת תשובה ב-cache). חיוני כשכל משתמש צריך לראות את **הנתונים שלו** ולא את הנתונים של מישהו אחר.

---

#### Zod — Validation בזמן ריצה

**מה זה:** Zod היא ספריית **validation** (אימות נתונים) לסביבת Server. גם אם TypeScript מגדיר types — הם נעלמים לאחר קומפילציה. כשמגיע JSON מה-client, TypeScript לא יכול לאמת שהנתון תואם את הטיפוס בזמן ריצה.

**Zod פותר זאת:**
```typescript
const AddCardSchema = z.object({
  balance: z.number().min(0),
  expiryDate: z.string().refine(d => new Date(d) > new Date(), "חייב להיות בעתיד"),
});
const body = AddCardSchema.parse(await req.json()); // זורק שגיאה אם לא תקין
```

**בפרויקט:** כל API route מגדיר Schema עם Zod ומבצע parse של ה-body לפני כל עיבוד.

---

### 2.5 מנוע החיפוש

#### Web Scraping — מה זה ולמה זה מסובך

**מה זה:** Web Scraping הוא תהליך של קריאת דפי HTML מאתרים והוצאת נתונים מהם אוטומטית. האתר לא מספק API רשמי — אז אנחנו קוראים את ה-HTML שהדפדפן רואה.

**למה אתרים חוסמים:** רשתות כמו **Cloudflare WAF (Web Application Firewall)** מזהות בקשות אוטומטיות לפי:
- User-Agent לא אנושי
- היעדר cookies של דפדפן
- תבניות בקשה לא טבעיות
- IP ממרכז נתונים

**הפתרון שלנו:** שליחת headers מלאים המחקים דפדפן אמיתי:
```typescript
"User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)...",
"Accept-Language": "he-IL,he;q=0.9",
"sec-ch-ua": '"Not/A)Brand";v="8", "Chromium";v="126"',
```

---

#### Cheerio — פענוח HTML

**מה זה:** Cheerio הוא כלי ל-Server-Side שמאפשר לנתח HTML בתחביר **jQuery** — כלומר CSS Selectors.

**דוגמה מהקוד (`src/lib/search/scrapers/bug.ts`):**
```typescript
const $ = cheerio.load(html);
$("a.product-cube-inner-2.tpurl").each((_, el) => {
  const name  = $(el).find(".c1").text().trim();
  const price = $(el).find(".c2 span").first().text();
});
```

---

#### SerpApi — Google Shopping

**מה זה:** SerpApi הוא שירות שמריץ עבורנו חיפושי Google בענן ומחזיר JSON מובנה. Google Shopping מציג מחירים של מוצרים ממאות חנויות — SerpApi מאפשר לגשת אליהם מבלי שגוגל יחסום אותנו.

**למה בחרנו SerpApi ולא scraping ישיר של Google:** Google חוסמת בקשות אוטומטיות בצורה אגרסיבית (Cloudflare + CAPTCHA). SerpApi מריץ את הבקשות משרתים ייעודיים שגוגל מכירה ומאפשרת.

**בפרויקט (`src/lib/search/scrapers/serpApiSearch.ts`):**
- Engine: `google_shopping`
- Location: Israel
- Locale: Hebrew
- מחזיר עד 10 תוצאות עם מחיר, חנות, קישור ותמונה

---

#### The Matchmaker — אלגוריתם החישוב

**מה זה:** ה-Matchmaker הוא הלב של OptiPay. הוא מקבל תוצאות גולמיות של מחירים וה**ארנק** של המשתמש, ומחשב את כל מסלולי הרכישה האפשריים.

**זרימת האלגוריתם (`src/lib/search/matchmaker.ts`):**

```
קלט: rawResults (מחירים מהאינטרנט) + userWallet (כרטיסים + חברויות)
         ↓
שלב 1: Resolve — המרת שמות חנויות ל-IDs ב-DB
         ↓
שלב 2: Load Context — טעינת הנחות מועדון לכל חנות + רשתות מקובלות
         ↓
שלב 3: Generate Routes — לכל מוצר, צור עד 4 מסלולים:
  ├── Route A: מחיר מלא (baseline)
  ├── Route B: כרטיס מתנה הטוב ביותר
  ├── Route C: הנחת מועדון הטובה ביותר
  └── Route B+C: שילוב (רק אם מותר!)
         ↓
שלב 4: Sort — מיון לפי finalPrice ASC
         ↓
פלט: Top 10 routes
```

**חישוב ההנחה:**
```
הנחה = מחיר_מקורי × (אחוז_הנחה / 100)
הנחה_מקסימלית = min(הנחה, maxDiscountAmount)
מחיר_סופי = מחיר_מקורי - הנחה_מקסימלית
```

---

#### No Double Dipping — כלל אי-הכפלת ההנחות

**מה זה:** "Double Dipping" (טבילה כפולה) הוא ניסיון להשתמש **גם** בכרטיס מתנה **וגם** בהנחת מועדון באותה רכישה, כשהחנות לא מאפשרת זאת. לדוגמה: Bug לא תמיד מאפשרת צירוף של כרטיס BuyMe עם הנחת KlavBY.

**איך מיושם:**
1. `StoreClubBenefit.noDoubleDiscount` — שדה בולאני: אם `true`, המועדון לא ניתן לצירוף עם שום כרטיס
2. `ClubNetworkRule` — טבלה שמגדירה **לכל צמד** של מועדון + רשת: האם `canCombine = true/false`

**בקוד:**
```typescript
// Route B+C (שילוב) נוצר רק אם:
if (!storeClubBenefit.noDoubleDiscount &&
    clubNetworkRule?.canCombine === true) {
  // צור מסלול משולב
}
```

---

### 2.6 AI ו-NLP

#### Gemini API — נירמול שאילתות

**מה זה LLM:** LLM (Large Language Model) הוא מודל בינה מלאכותית שאומן על כמויות עצומות של טקסט. הוא מסוגל להבין שפה טבעית ולהחזיר תשובות מובנות.

**מה זה NLP:** NLP (Natural Language Processing) הוא ענף ב-AI שעוסק בהבנת שפה אנושית על ידי מחשב.

**הבעיה שנפתרת:** "אייפון 15 פרו 256 ג'יגה שחור" ו-"iPhone 15 Pro 256GB Black" הן אותה שאילתה. אבל חיפוש literal יחזיר תוצאות שונות מ-Bug ו-SerpApi. Gemini ממיר שניהם ל:
```json
{
  "canonical": "Apple iPhone 15 Pro 256GB Black",
  "brand": "Apple",
  "model": "iPhone 15 Pro",
  "specs": ["256GB", "Black"]
}
```

**בקוד (`src/lib/search/normalizer.ts`):**
```typescript
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
const result = await model.generateContent(prompt);
// returns structured JSON with canonical English name
```

**Fallback:** אם ה-API לא זמין, מחזיר את השאילתה המקורית ללא שינוי.

---

### 2.7 PWA — Progressive Web App

#### מה זה PWA?

PWA הוא אתר אינטרנט שמתנהג **כמו אפליקציה נייטיב**. ההבדלים:

| | אתר רגיל | PWA | אפליקציה נייטיב |
|--|---------|-----|----------------|
| התקנה על מסך הבית | ❌ | ✅ | ✅ |
| עובד Offline | ❌ | ✅ | ✅ |
| Push Notifications | ❌ | ✅ | ✅ |
| App Store נדרש | ❌ | ❌ | ✅ |
| עדכון אוטומטי | ✅ | ✅ | ❌ (צריך לאשר) |

---

#### Service Worker

**מה זה:** Service Worker הוא קובץ JavaScript שפועל ב-background, **בנפרד מדף האינטרנט**. הוא מיירט בקשות רשת ויכול להחזיר תשובות מ-cache.

**בפרויקט (`public/sw-custom.js`):**
- **NetworkFirst** עבור `/api/wallet/*` — מנסה את הרשת, ואם נכשל — מחזיר מה-cache (30 שניות timeout)
- **CacheFirst** עבור `/_next/static/*` — קודם cache, רק אם אין — רשת (קבצי CSS/JS לא משתנים)
- **NetworkFirst** עבור דפים — תמיד מנסה את הרשת, Offline fallback

**`skipWaiting()` + `clientsClaim()`:** כשגרסה חדשה של ה-Service Worker מגיעה, היא לא ממתינה — משתלטת מיד על כל הטאבים.

---

#### manifest.json — הגדרות PWA

קובץ `public/manifest.json` מגדיר לדפדפן כיצד להציג את ה-PWA:
```json
{
  "name": "OptiPay – חיסכון חכם",
  "display": "standalone",    // ← מסתיר את ה-URL bar
  "lang": "he",
  "dir": "rtl",               // ← תמיכה בעברית מימין לשמאל
  "theme_color": "#1B4FDB",   // ← צבע ה-status bar
  "icons": [...]              // ← אייקונים לכל הגדלים
}
```

---

#### Web Push Notifications

**VAPID Keys:** Web Push מחייב זוג מפתחות (VAPID) שמזהה את ה-server שלנו. הדפדפן שומר subscription עם endpoint ייחודי.

**הזרימה:**
1. המשתמש מאשר התראות → הדפדפן יוצר subscription (endpoint + מפתחות הצפנה)
2. ה-subscription נשמר ב-`PushSubscription` table
3. Cron job מוצא כרטיסים שפגים → שולח push דרך `web-push` library
4. הדפדפן מקבל את ה-push ומציג התראה — גם כשה-app סגור

---

#### "הוסף למסך הבית"

**Android (Chrome):** `beforeinstallprompt` event — אירוע שמופיע כשהדפדפן מחליט שהאתר עומד בקריטריוני PWA. ניתן לאחסן אותו ולהציג כפתור התקנה מותאם אישית.

**iOS (Safari):** לא תומך ב-`beforeinstallprompt`. המשתמש חייב ללחוץ על כפתור "שתף" → "הוסף למסך הבית" ידנית. הרכיב `src/components/pwa/InstallPrompt.tsx` מסביר זאת למשתמשי iOS.

---

### 2.8 פריסה ותשתית

#### Vercel

**מה זה:** Vercel הוא שירות פריסה (deployment) ל-Next.js. כשדוחפים קוד ל-GitHub, Vercel אוטומטית:
1. מריץ `npm run build`
2. פורס את הקוד ל-Edge Network (רשת שרתים גלובלית)
3. מספק URL (כמו `optipay.vercel.app`)

**Serverless Functions:** כל API route רץ כ-"Serverless Function" — פונקציה שמופעלת לפי דרישה, ללא שרת קבוע.

**Edge Network CDN:** קבצים סטטיים (CSS, JS, תמונות) מוגשים מהשרת הגיאוגרפית הקרוב למשתמש.

---

#### Vercel Cron Jobs

**מה זה:** Cron Job הוא משימה מתוזמנת שרצה אוטומטית לפי לוח זמנים.

**`vercel.json`:**
```json
{
  "crons": [{
    "path": "/api/cron/scrape",
    "schedule": "0 2 * * *"   // ← כל יום ב-2 בלילה UTC
  }]
}
```

**מגבלת Free Tier:** ב-Vercel Hobby (חינמי), פונקציות serverless יכולות לרוץ מקסימום **60 שניות**. לכן הסורק מגביל ל-5 מועדונים לכל הרצה.

---

#### Environment Variables

**מה זה:** משתני סביבה הם ערכים שמוגדרים **מחוץ לקוד** — סיסמאות, מפתחות API, URLs. הם לא נכנסים ל-Git.

**`.env` (לא ב-Git):**
```
DATABASE_URL="postgresql://..."
JWT_SECRET="super-secret-key"
ENCRYPTION_KEY="64-hex-chars"
SERPAPI_KEY="..."
GEMINI_API_KEY="..."
```

**ב-Vercel:** מוגדרים ב-Dashboard → Settings → Environment Variables. Vercel מזריק אותם בזמן build ו-runtime.

---

#### GitHub

**מה זה:** GitHub הוא שירות לאחסון קוד עם ניהול גרסאות (Git). Git מאפשר:
- `git add` — סימון קבצים לשמירה
- `git commit -m "message"` — שמירת snapshot של הקוד עם הודעה
- `git push` — העלאת הקוד ל-GitHub → מפעיל פריסה אוטומטית ב-Vercel

---

### 2.9 כלי פיתוח

#### Claude Code — עוזר AI לקוד

Claude Code הוא AI coding assistant שהשתמשנו בו לפיתוח הפרויקט. סייע ב:
- כתיבת API routes מלאים לפי spec
- תיקון bugs מורכבים (כמו ניתוח שגיאות TypeScript)
- Refactoring של קוד קיים
- כתיבת שאילתות Prisma מורכבות

**Context Window:** לכל AI יש "חלון הקשר" — כמות הטקסט שהוא יכול לזכור בשיחה אחת. פרויקט גדול כמו OptiPay עבר את גבול ה-context window, ולכן חילקנו את הפיתוח ל**סשנים נפרדים** — כל סשן עם סיכום של מה שנעשה לפניו.

---

#### `prisma migrate dev`

**מה זה Migration:** כשמשנים את `schema.prisma` (מוסיפים שדה, מוחקים טבלה), לא ניתן פשוט לשנות את ה-DB ישירות. Migration הוא **קובץ SQL** שמתאר את השינוי:
```sql
-- 20260512_add_family_sharing_toggle
ALTER TABLE "gift_cards" ADD COLUMN "isSharedWithFamily" BOOLEAN DEFAULT false;
```

**למה חשוב:** ניתן לחזור לגרסה ישנה, לסנכרן DB בין developers, ולדעת בדיוק מה שונה ומתי.

---

#### `npm run build`

**מה קורה:**
1. TypeScript מקמפל את כל קבצי `.ts`/`.tsx` ל-JavaScript
2. Next.js מבצע אופטימיזציה — מחלק את הקוד ל-chunks קטנים
3. בודק Type Errors — שגיאות TypeScript יופיעו כאן
4. יוצר את תיקיית `.next/` עם כל הקוד הממוטב

**למה חשוב לעבור Build:** שגיאות TypeScript שנשארות בקוד לא יימצאו בפיתוח אבל **יאסרו פריסה ל-Vercel**.

---

## 3. החלטות עיצוב מרכזיות

### PostgreSQL במקום MongoDB

**אלטרנטיבה:** MongoDB — בסיס נתונים document-based שמאחסן JSON.

**למה בחרנו PostgreSQL:**
- הנתונים שלנו **רלציוניים עמוקים**: User → Wallet → Card → Network → StoreNetwork → Store → StoreClubBenefit → Club → ClubNetworkRule
- Joins מורכבים (כמו "כל ההנחות האפשריות לכרטיס BuyMe בחנויות שמוכרות אייפונים") הם טבעיים ב-SQL
- **ACID transactions**: כשמנכים מכרטיס מתנה, חייבים consistency — MongoDB מאפשר ACID אבל זה לא הדיפולט
- **Prisma מצוין עם PostgreSQL**: אינטגרציה מושלמת + Migrations

---

### Next.js במקום Express + React

**אלטרנטיבה:** Backend נפרד (Express.js) + Frontend נפרד (Create React App).

**למה בחרנו Next.js:**
- **Monorepo**: קוד ה-API וקוד ה-UI חיים יחד — קל יותר לשתף types ולוגיקה
- **API Routes collocated**: הקוד של `/api/wallet/cards` יושב ליד הקוד של דף הארנק
- **Vercel deployment**: Vercel בנויה בדיוק ל-Next.js — deploy ב-push בלי הגדרה
- **Server Components**: חלקים מה-UI יכולים לרוץ על השרת בלי שליחת JS ל-client

---

### SerpApi במקום Web Scraping ישיר של Google

**אלטרנטיבה:** Puppeteer/Playwright לסריקת Google Shopping ישירות.

**למה בחרנו SerpApi:**
- גוגל חוסמת בקשות אוטומטיות בצורה אגרסיבית (CAPTCHA, IP block)
- מ-IP של Vercel (AWS) — גוגל ידעה שזה אוטומציה ותחסום מיד
- SerpApi עולה כסף אבל **אמין ב-99.9%** — עדיף להשקיע שם מאשר להתמודד עם חסימות

---

### JWT ב-httpOnly Cookies במקום localStorage

**אלטרנטיבה:** שמירת ה-token ב-`localStorage` של הדפדפן.

**למה בחרנו httpOnly cookies:**
- **XSS Attack**: אם תוקף מצליח להחדיר קוד JavaScript לאתר, הוא לא יכול לגנוב cookie httpOnly — JavaScript לא יכול לגשת אליו
- `localStorage` **נגיש ל-JavaScript** — חולשה ישירה

**הפשרה בפרויקט:** הפרויקט משתמש ב-**dual auth** — cookie httpOnly + localStorage. ה-localStorage משמש לנוחות הקוד בצד ה-client (access לטוקן ב-hooks), בעוד ה-cookie מאפשר SSR (Server-Side Rendering) עם אימות.

---

### PWA במקום React Native

**אלטרנטיבה:** React Native — כתיבת אפליקציה נייטיב לאנדרואיד ו-iOS.

**למה בחרנו PWA:**
- **זמן פיתוח**: React Native מחייב ידע ספציפי ו-setup מורכב. PWA הוא פשוט אתר רגיל עם קובץ manifest ו-Service Worker
- **App Store**: אין צורך בהגשה ל-App Store Apple/Google (תהליך שלוקח שבועות ועולה כסף)
- **Codebase אחד**: אותו קוד עובד על iOS, Android, Desktop
- **עדכונים**: עדכון אוטומטי — המשתמש תמיד מקבל את הגרסה העדכנית
- **מגבלה**: iOS Safari לא תומך ב-Push Notifications בצורה מלאה (שופר ב-iOS 16.4+)

---

### Prisma במקום Raw SQL

**אלטרנטיבה:** כתיבת שאילתות SQL ישירות עם `pg` library.

**למה בחרנו Prisma:**
- **Type Safety**: TypeScript יודע בדיוק אילו שדות מחזיר כל query
- **Migrations**: ניהול גרסאות של הסכמה
- **DX**: קוד קריא — `prisma.giftCard.findMany(...)` במקום `SELECT * FROM gift_cards WHERE...`
- **Auto-complete**: IDE מציע שדות אפשריים בזמן כתיבה

---

### Supabase במקום PostgreSQL עצמי

**אלטרנטיבה:** התקנת PostgreSQL על שרת VPS (DigitalOcean, AWS EC2).

**למה בחרנו Supabase:**
- **חינמי**: Free tier מספק 500MB DB + 2GB bandwidth
- **Managed**: גיבויים אוטומטיים, עדכוני אבטחה, Uptime monitoring
- **ללא DevOps**: אין צורך להגדיר שרת, SSL, firewalls, backups
- **pgBouncer מובנה**: Connection pooling ב-port 6543 כלול

---

## 4. אמצעי האבטחה

| # | אמצעי | איפה בקוד | מה מגן מפניו |
|---|-------|-----------|--------------|
| 1 | **AES-256-GCM** על מספרי כרטיסים | `src/lib/encryption.ts` | גנבת מסד נתונים — גם עם גישה ל-DB, המספרים לא קריאים |
| 2 | **bcrypt (12 rounds)** על סיסמאות | `src/lib/auth.ts` | Brute Force, Rainbow Tables — גם עם גישה ל-DB |
| 3 | **JWT ב-httpOnly Cookie** | `src/app/api/auth/login/route.ts` | XSS Attack — JavaScript לא יכול לגנוב cookie httpOnly |
| 4 | **Account Lockout** (5 ניסיונות) | `src/app/api/auth/login/route.ts` | Brute Force על סיסמאות |
| 5 | **Zod Validation** בכל API route | כל `route.ts` | Injection Attacks, Invalid Data |
| 6 | **`force-dynamic`** על כל API | כל `route.ts` | Data Leakage — מניעת הגשת תשובות של משתמש א' למשתמש ב' |
| 7 | **Environment Variables** | `.env` + Vercel Dashboard | Secret Exposure בקוד ב-GitHub |
| 8 | **Soft Delete** (`deletedAt`) | `GiftCard`, `User` | Privacy — נתונים ניתנים לשחזור, לא נמחקים לגמרי |

---

## 5. שאלות בוחן צפויות ותשובות

### "מה זה Progressive Web App ואיך הוא שונה מאתר רגיל?"

PWA הוא אתר שמיישם מספר יכולות שהפכות אותו קרוב לאפליקציה נייטיב:

**3 דרישות ל-PWA:**
1. **HTTPS** — חיבור מאובטח (Vercel מספק אוטומטית)
2. **manifest.json** — קובץ שמגדיר שם, אייקונים, ו-display mode
3. **Service Worker** — קובץ JS שמנהל caching ו-offline

**ההבדלים מאתר רגיל:**
- **Installable**: כפתור "הוסף למסך הבית" — האתר מופיע כאפליקציה
- **Offline**: Service Worker מגיש נתונים מ-cache כשאין רשת
- **Push Notifications**: שליחת התראות גם כשהאפליקציה סגורה

**ב-OptiPay:** ה-Service Worker שומר את רשימת הכרטיסים ב-cache — המשתמש יכול לראות את ארנקו גם ללא אינטרנט.

---

### "למה בחרתם PostgreSQL ולא MongoDB?"

הנתונים של OptiPay הם **מבנה רלציוני עמוק**. לדוגמה, שאילתה כמו "מה הנחת מועדון KlavBY על כרטיסי BuyMe בחנות Bug?" מחייבת:
```
User → UserClubMembership → Club
User → GiftCard → GiftCardNetwork
GiftCardNetwork → StoreNetwork → Store
Club → StoreClubBenefit → Store
Club + GiftCardNetwork → ClubNetworkRule
```

ב-SQL זה `JOIN` אחד אחד מסוים. ב-MongoDB, שאינו relational, היינו צריכים לדנרמל את הכל או לעשות שאילתות מרובות.

בנוסף, **ACID transactions**: כשמנכים ₪50 מכרטיס ומוסיפים רשומה ב-SearchHistory — אלה שתי פעולות שחייבות להצליח ביחד. PostgreSQL מבטיח זאת.

---

### "איך עובד מנוע החיפוש? תעבור על שאילתה."

**דוגמה: משתמש מחפש "אייפון 15 פרו"**

1. **POST /api/search** מקבל `{ query: "אייפון 15 פרו" }`

2. **Normalization** — Gemini API ממיר:
   ```json
   { "canonical": "Apple iPhone 15 Pro", "brand": "Apple" }
   ```

3. **Scraping** (בו-זמנית):
   - Bug.co.il: סורק עם "Apple iPhone 15 Pro" → 5 תוצאות
   - SerpApi: שולח לגוגל → 10 תוצאות ממאות חנויות

4. **Load Wallet**: טוען מה-DB את כרטיסי המתנה והחברויות של המשתמש

5. **Matchmaker**: עבור כל מוצר, בודק:
   - האם לחנות `bug` יש שורה ב-StoreNetwork עם BuyMe? ✅ → Route B (כרטיס BuyMe)
   - האם לחנות `bug` יש שורה ב-StoreClubBenefit עם KlavBY? ✅ → Route C (KlavBY 10%)
   - `ClubNetworkRule` עבור KlavBY + BuyMe → `canCombine: false` → Route B+C ❌

6. **Return**: מחזיר Top 10 מסלולים, ממוינים לפי `finalPrice`

---

### "איך אתם מגינים על מידע רגיש כמו מספרי כרטיסים?"

**שכבות הגנה:**

1. **AES-256-GCM**: מספר הכרטיס מוצפן **לפני** שמירה ב-DB:
   ```
   encrypt("1234567890123456") → "c3VwZXJzZWNyZXQ..." (base64)
   ```

2. **Card Hint**: מאחסנים רק **4 הספרות האחרונות** בטקסט חופשי (`cardNumberHint`) — לתצוגה בלבד

3. **Key בסביבה**: מפתח ההצפנה (`ENCRYPTION_KEY`) נמצא **רק** ב-Environment Variables — לא בקוד ולא ב-Git

4. **תוקפים שפרצו ל-DB** ייראו רק `c3VwZXJzZWNyZXQ...` — לא יכולים לעשות כלום ללא המפתח

---

### "מה זה JWT וכיצד עובד האימות?"

JWT (JSON Web Token) הוא **אסימון חתום דיגיטלית** שמאפשר לשרת לאמת זהות ללא שמירת session ב-DB.

**מבנה:** `header.payload.signature`
- Header: `{"alg": "HS256"}`
- Payload: `{"userId": "abc123", "exp": 1720000000}`
- Signature: `HMAC-SHA256(header + "." + payload, JWT_SECRET)`

**אף אחד לא יכול לזייף** את ה-token בלי לדעת את ה-`JWT_SECRET`.

**הזרימה ב-OptiPay:**
1. Login → שרת מחזיר JWT ב-httpOnly Cookie
2. כל בקשה → Cookie נשלח אוטומטית → `middleware.ts` מאמת עם `jwt.verify()`
3. אם תקף → מחלץ `userId` → מבצע query רק עם הנתונים של המשתמש הזה

**httpOnly Cookie**: הדפדפן שולח את ה-cookie אוטומטית, JavaScript לא יכול לגשת אליו → הגנה מ-XSS.

---

### "מה זה Prisma ואיזה בעיה הוא פותר?"

**הבעיה**: כתיבת SQL ישירות ב-TypeScript היא:
- **Error-prone**: שגיאות כתיב ב-SQL גרמו ל-runtime errors שאי אפשר לגלות ב-compile time
- **Verbose**: `SELECT id, balance, expiry_date FROM gift_cards WHERE user_id = $1`
- **Type Unsafe**: TypeScript לא יודע מה חוזר מה-query

**הפתרון של Prisma**:
```typescript
const card = await prisma.giftCard.findFirst({
  where: { userId, isArchived: false },
  select: { balance: true, expiryDate: true }
});
// TypeScript יודע: card.balance הוא Decimal, card.expiryDate הוא Date
```

Prisma גם מנהל **Migrations** — גרסאות שינויים ב-schema, מה שמאפשר סנכרון בין מפתחים ו-environments.

---

### "איך עובד אלגוריתם ה-Matchmaker?"

ה-Matchmaker מקבל רשימת מוצרים עם מחירים ומחזיר "מסלולי קנייה" ממוינים לפי מחיר סופי.

**לכל מוצר, יוצר עד 4 מסלולים:**

- **Route A (Baseline)**: מחיר מלא — בלי שום הנחה. תמיד קיים.
- **Route B (Gift Card)**: הכרטיס הטוב ביותר שהחנות מקבלת. בודק: `StoreNetwork` מכיל את ה-network של הכרטיס? יתרת הכרטיס > 0?
- **Route C (Club)**: הנחת המועדון הטובה ביותר. בודק: `StoreClubBenefit` קיים עבור החנות + המועדון? גובה הקנייה עומד ב-`minPurchaseAmount`?
- **Route B+C (Combined)**: צירוף כרטיס + מועדון. יוצר **רק** אם: `StoreClubBenefit.noDoubleDiscount = false` AND `ClubNetworkRule.canCombine = true`

**מיון**: Top 10 לפי `finalPrice ASC` → הכי זול ראשון.

---

### "מה כלל ה-No Double Dipping ואיך אוכפים אותו?"

**No Double Dipping** = לא ניתן לקבל שתי הנחות שלא ניתן לשלב.

**דוגמה**: קנייה ב-Bug עם כרטיס BuyMe (5% הנחה) + מועדון KlavBY (10% הנחה). אם Bug וKlavBY קבעו `noDoubleDiscount = true` — הלקוח יכול לבחור **רק אחת** מהשניים.

**אכיפה ב-DB:**
- `StoreClubBenefit.noDoubleDiscount` — ברמת החנות: "מועדון זה בחנות זו לא ניתן לצירוף"
- `ClubNetworkRule` — ברמת הצמד מועדון-רשת: `{clubId, networkId, canCombine: false}`

**אכיפה בקוד:**
```typescript
if (benefit.noDoubleDiscount || !rule?.canCombine) {
  // Route B+C לא נוצר
  continue;
}
```

---

### "אילו אתגרים נתקלתם בהם ואיך פתרתם?"

**1. Cloudflare חסמה את הסריקה**
- הבעיה: bug.co.il מוגן ב-Cloudflare. בקשות מ-Vercel נחסמות
- הפתרון: headers מלאים שמחקים דפדפן אמיתי + User-Agent של iPhone + זיהוי דף Challenge (`cf-browser-verification`)

**2. Dashboard הראה אפסים**
- הבעיה: ה-Dashboard שאל את טבלת `SavingsRecord` שתמיד הייתה ריקה
- הגילוי: הקוד ב-`use-route` כותב ל-`SearchHistory.savingsAmount`, לא ל-`SavingsRecord`
- הפתרון: שינינו את ה-Dashboard לשאול את הטבלה הנכונה

**3. מיגרציה נכשלה עם pgBouncer**
- הבעיה: `prisma migrate dev` נכשל עם P1001 כשמתחבר דרך pgBouncer (פורט 6543)
- הפתרון: שימוש ב-`DIRECT_URL` (פורט 5432) — direct connection שPrisma דורש למיגרציות

**4. DLL נעול ב-Windows**
- הבעיה: `prisma generate` נכשל כי `query_engine-windows.dll.node` נעול על ידי process אחר
- הפתרון: `prisma generate --no-engine` — מחדש את ה-TypeScript types בלי להחליף את ה-DLL

---

### "מה זה Service Worker ומה הוא מאפשר?"

Service Worker הוא **proxy** שמיירט את כל הבקשות הרשת שה-app שולח.

**3 יכולות עיקריות:**

1. **Caching (Offline Mode)**: כש-user ביקר בארנק, ה-Service Worker שומר את תשובת ה-API ב-Cache Storage. בפעם הבאה שאין רשת — מחזיר מה-Cache.

2. **Push Notifications**: ה-Service Worker יכול לקבל Push מהשרת גם כשהאפליקציה סגורה, ולהציג notification.

3. **Background Sync**: אם ניסית לשמור נתון ללא רשת, ה-Service Worker ישלח אותו כשהרשת חוזרת.

**ב-OptiPay (`public/sw-custom.js`)**: Workbox (ספרייה של Google) מנהלת אסטרטגיות Cache:
- `/api/wallet/*` → NetworkFirst (נסה רשת, כישלון → Cache)
- `/_next/static/*` → CacheFirst (קבצים לא משתנים)

---

### "איך עובדת האינטגרציה עם SerpApi?"

1. שאילתה מנורמלת מגיעה ל-`searchWithSerpApi(query)`
2. הפונקציה שולחת בקשה ל-SerpApi עם parameters:
   ```
   engine: "google_shopping"
   q: "Apple iPhone 15 Pro"
   location: "Israel"
   hl: "he"  // שפת Google
   ```
3. SerpApi מחזיר JSON עם `shopping_results[]` — כל אחד מכיל:
   - `title`: שם המוצר
   - `extracted_price`: מחיר מספרי
   - `source`: שם החנות (ZAP, KSP וכו')
   - `link`: קישור למוצר
4. הפונקציה ממפה `source` → slug (ZAP → `"zap"`)
5. מחזירה `RawResult[]` מסוין לפי מחיר

---

### "למה בחרתם ב-Vercel לפריסה?"

**Reasons:**
1. **Next.js Native**: Vercel פיתחה את Next.js — האינטגרציה מושלמת, ללא הגדרה נוספת
2. **Auto Deploy**: `git push` → Vercel בונה ופורסת אוטומטית תוך 60 שניות
3. **Preview Deployments**: כל PR מקבל URL preview — ניתן לבדוק לפני merge
4. **Free Tier**: Hobby plan חינמי מספיק לפרויקט סטודנטי
5. **Edge Network**: CDN גלובלי — קבצים סטטיים מוגשים מישראל לישראל

---

### "מה זה AES-256 ולמה השתמשתם בו?"

**AES** (Advanced Encryption Standard) הוא תקן הצפנה סימטרי — המפתח מצפין ומפענח.

**256** = אורך המפתח ב-bits. כדי לנסות את כל המפתחות האפשריים, תוקף יצטרך `2^256` ניסיונות. עם כל מחשבי העולם, זה ייקח יותר מגיל היקום.

**GCM** (Galois/Counter Mode) = מצב הצפנה שמוסיף **Authentication Tag** — אם מישהו שינה את ה-ciphertext, הפענוח יכשל.

**למה השתמשנו:**
- מספרי כרטיסים **חייבים להיות ניתנים לשחזור** (לא ניתן להשתמש בגיבוב)
- אם בסיס הנתונים נפרץ — התוקף יראה `aGVsbG8gd29ybGQ=` בלבד
- AES-256 הוא **תקן ממשלתי** שמאושר לנתונים סודיים ביותר (NSA Top Secret)

---

### "איך עובד הפיצ'ר של שיתוף עם המשפחה?"

**ארכיטקטורה:**
1. משתמש יוצר `FamilyGroup` ומזמין חברים (email invitation)
2. חברים מצטרפים → נוצר `FamilyGroupMember` record
3. לכל `GiftCard` ו-`UserClubMembership` יש שדה `isSharedWithFamily: Boolean`
4. בעל הכרטיס מפעיל toggle → `PATCH /api/wallet/cards/[id]` עם `{ isSharedWithFamily: true }`

**הצגה בארנק:**
- `GET /api/wallet/cards` בודק: האם המשתמש חבר בקבוצה משפחתית?
- אם כן: מביא גם את הכרטיסים של שאר החברים שיש להם `isSharedWithFamily = true`
- הכרטיסים השותפים מסומנים `isShared: true` + `sharedBy: "שם החבר"`
- בממשק: כרטיסים שותפים מציגים badge "👨‍👩‍👧 שותף על ידי [שם]" ואין להם כפתורי עריכה/מחיקה

---

## 6. מפת ארכיטקטורת הקוד

```
optipay/
│
├── prisma/
│   ├── schema.prisma          ← הגדרת כל 14 המודלים ויחסיהם ב-PostgreSQL
│   ├── migrations/            ← קבצי SQL של כל שינוי היסטורי בסכמה
│   ├── seed.ts                ← נתוני זרע: מועדונים ורשתות ישראליות
│   └── seed-store-data.ts     ← נתוני זרע: קשרי חנות↔רשת↔הנחת מועדון
│
├── src/
│   ├── app/                   ← Next.js App Router — כל תיקייה = נתיב URL
│   │   │
│   │   ├── (auth)/            ← דפי אימות (layout נפרד ללא TopBar/BottomNav)
│   │   │   ├── login/         ← /login — טופס התחברות
│   │   │   ├── register/      ← /register — טופס הרשמה
│   │   │   └── reset-password/← /reset-password — איפוס סיסמה
│   │   │
│   │   ├── api/               ← כל ה-backend API routes (Server-side only)
│   │   │   ├── auth/
│   │   │   │   ├── login/route.ts     ← POST: אימות + הפקת JWT
│   │   │   │   ├── register/route.ts  ← POST: יצירת משתמש + JWT
│   │   │   │   ├── logout/route.ts    ← POST: ביטול cookie
│   │   │   │   ├── me/route.ts        ← GET: פרטי המשתמש המחובר
│   │   │   │   ├── account/route.ts   ← DELETE: מחיקת חשבון (soft delete)
│   │   │   │   └── reset-password/    ← POST request + POST confirm
│   │   │   │
│   │   │   ├── wallet/
│   │   │   │   ├── cards/
│   │   │   │   │   ├── route.ts       ← GET: רשימת כרטיסים | POST: הוסף כרטיס
│   │   │   │   │   ├── archived/route.ts ← GET: כרטיסים בארכיון
│   │   │   │   │   └── [id]/
│   │   │   │   │       ├── route.ts   ← PATCH: עדכן | DELETE: מחק
│   │   │   │   │       └── history/route.ts ← GET: היסטוריית שימוש
│   │   │   │   ├── memberships/
│   │   │   │   │   ├── route.ts       ← GET: חברויות | POST: הוסף חברות
│   │   │   │   │   └── [id]/route.ts  ← PATCH: עדכן | DELETE: הסר
│   │   │   │   ├── networks/route.ts  ← GET: רשתות כרטיסים (לטופס הוספה)
│   │   │   │   ├── clubs/route.ts     ← GET: מועדונים (לטופס הוספה)
│   │   │   │   └── use-route/route.ts ← POST: שימוש במסלול → ניכוי + שמירת חיסכון
│   │   │   │
│   │   │   ├── search/
│   │   │   │   ├── route.ts           ← POST: חיפוש מוצר (scrape + matchmaker)
│   │   │   │   └── history/route.ts   ← GET: היסטוריית חיפושים
│   │   │   │
│   │   │   ├── notifications/
│   │   │   │   ├── route.ts           ← GET: רשימה | PATCH: סמן כנקרא
│   │   │   │   └── generate/route.ts  ← POST: צור התראות לפריטים פגי תוקף
│   │   │   │
│   │   │   ├── family/
│   │   │   │   ├── group/route.ts     ← GET: פרטי קבוצה | POST: צור קבוצה
│   │   │   │   └── invite/route.ts    ← POST: שלח הזמנה | PATCH: קבל/דחה
│   │   │   │
│   │   │   ├── dashboard/route.ts     ← GET: נתוני חיסכון מצטבר + גרף חודשי
│   │   │   ├── profile/route.ts       ← GET: פרופיל | PATCH: עדכן פרטים
│   │   │   ├── push/subscribe/route.ts← POST: רשם subscription | DELETE: בטל
│   │   │   ├── clubs/route.ts         ← GET: כל המועדונים (לחיפוש)
│   │   │   ├── cron/scrape/route.ts   ← GET: נקודת כניסה ל-Vercel Cron Job
│   │   │   ├── admin/scrape/route.ts  ← POST: הפעלה ידנית של הסורק (Admin)
│   │   │   └── support/tickets/route.ts ← GET: כרטיסי תמיכה | POST: פתח כרטיס
│   │   │
│   │   ├── wallet/                    ← /wallet — ארנק ראשי (כרטיסים + חברויות)
│   │   │   ├── page.tsx               ← UI הארנק עם tabs + modals להוספה
│   │   │   ├── add/page.tsx           ← /wallet/add — טופס הוספה ייעודי
│   │   │   ├── archive/page.tsx       ← /wallet/archive — כרטיסים בארכיון
│   │   │   └── [id]/page.tsx          ← /wallet/[id] — פרטי כרטיס + היסטוריה
│   │   │
│   │   ├── search/page.tsx            ← /search — חיפוש מוצר + הצגת מסלולים
│   │   ├── dashboard/page.tsx         ← /dashboard — גרף חיסכון + ROI מועדונים
│   │   │
│   │   ├── profile/
│   │   │   ├── page.tsx               ← /profile — תפריט פרופיל
│   │   │   ├── edit/page.tsx          ← עריכת שם + תמונה + טלפון
│   │   │   ├── password/page.tsx      ← שינוי סיסמה
│   │   │   ├── accessibility/page.tsx ← הגדרות נגישות (גודל טקסט, ניגודיות)
│   │   │   └── family/page.tsx        ← ניהול קבוצת משפחה
│   │   │
│   │   ├── notifications/page.tsx     ← /notifications — רשימת התראות
│   │   ├── support/page.tsx           ← /support — פניית תמיכה
│   │   ├── offline/page.tsx           ← /offline — דף Fallback כשאין רשת
│   │   │
│   │   ├── layout.tsx                 ← Root Layout: HTML, meta tags, PWA setup
│   │   ├── globals.css                ← CSS גלובלי: Tailwind, CSS variables, RTL
│   │   └── page.tsx                   ← / — דף הבית (hero + CTA)
│   │
│   ├── components/
│   │   ├── layout/
│   │   │   ├── TopBar.tsx             ← סרגל עליון: לוגו/כותרת + פעמון התראות
│   │   │   ├── BottomNav.tsx          ← ניווט תחתון: חיפוש/ארנק/חיסכון/פרופיל
│   │   │   ├── MainContent.tsx        ← Wrapper לתוכן + padding לסרגלים
│   │   │   └── AuthShell.tsx          ← Client Component: מרשם SW + מציג TopBar/BottomNav
│   │   │
│   │   ├── wallet/
│   │   │   ├── GiftCardItem.tsx       ← כרטיס כרטיס-מתנה: יתרה, תוקף, toggle שיתוף
│   │   │   └── MembershipItem.tsx     ← כרטיס חברות: הנחה, תוקף, toggle שיתוף
│   │   │
│   │   ├── ui/                        ← רכיבי UI בסיסיים שנוצרו עם Radix UI
│   │   │   ├── Button.tsx             ← כפתור עם variants (primary/ghost/danger)
│   │   │   ├── Input.tsx              ← שדה קלט מעוצב
│   │   │   └── Toaster.tsx            ← מערכת Toast notifications
│   │   │
│   │   └── pwa/
│   │       └── InstallPrompt.tsx      ← הנחיות "הוסף למסך הבית" לפי מערכת הפעלה
│   │
│   ├── hooks/                         ← Custom React Hooks — לוגיקה שניתנת לשימוש חוזר
│   │   ├── useAuth.ts                 ← מצב התחברות גלובלי: user, token, login, logout
│   │   ├── useWallet.ts               ← כרטיסים וחברויות: CRUD + optimistic updates
│   │   └── useToast.ts                ← הצגת Toast messages מכל מקום בקוד
│   │
│   ├── lib/
│   │   ├── prisma.ts                  ← Singleton Prisma client (מניע יצירה כפולה)
│   │   ├── auth.ts                    ← JWT sign/verify + bcrypt hash/compare
│   │   ├── encryption.ts              ← AES-256-GCM encrypt/decrypt + lastNChars
│   │   ├── utils.ts                   ← formatILS, formatDateHe, isExpiringSoon, cn()
│   │   │
│   │   ├── search/
│   │   │   ├── types.ts               ← RawResult, BuyingRoute — interfaces משותפים
│   │   │   ├── normalizer.ts          ← Gemini API: עברית/אנגלית → canonical English
│   │   │   ├── matchmaker.ts          ← האלגוריתם: חישוב מסלולי קנייה + No Double Dip
│   │   │   └── scrapers/
│   │   │       ├── bug.ts             ← Cheerio scraper: bug.co.il (גלאי Cloudflare)
│   │   │       └── serpApiSearch.ts   ← Google Shopping דרך SerpApi
│   │   │
│   │   └── cron/
│   │       ├── clubScraper.ts         ← Playwright: עדכון הנחות מועדונים יומי
│   │       └── expiryChecker.ts       ← שליחת Push Notification לפריטים פגי תוקף
│   │
│   └── server/
│       └── auth/
│           └── middleware.ts          ← requireAuth/requireAdmin/getUserId
│
├── public/
│   ├── manifest.json                  ← PWA: שם, אייקונים, theme_color, RTL
│   ├── sw-custom.js                   ← Service Worker: Workbox caching strategies
│   ├── logo.png                       ← לוגו ראשי (מוצג ב-TopBar בדף הבית)
│   ├── apple-touch-icon.png           ← אייקון iOS home screen (180×180)
│   ├── favicon.png                    ← אייקון browser tab (32×32)
│   └── icons/                         ← אייקוני PWA לכל הגדלים (16px–512px)
│
├── scripts/
│   └── generate-icons.mjs            ← יצירת אייקוני PWA מ-logo.png עם sharp
│
├── prisma/
│   └── migrations/                    ← כל קבצי ה-SQL של ה-Migrations
│
├── vercel.json                        ← Cron schedule: יומי 2:00 AM UTC
├── tsconfig.json                      ← הגדרות TypeScript
├── tsconfig.seed.json                 ← TypeScript config לסקריפטי seed
├── tailwind.config.ts                 ← Tailwind: צבעים מותאמים, RTL support
├── next.config.js                     ← Next.js + PWA (next-pwa) הגדרות
└── package.json                       ← Dependencies + scripts (dev/build/db:*)
```

---

## נספח — מילון מונחים טכניים

| מונח | הסבר קצר |
|------|----------|
| **API** | ממשק תכנות שמאפשר לתוכנות לתקשר |
| **ORM** | שכבה שמתרגמת קוד לשאילתות DB |
| **JWT** | אסימון מאובטח לאימות זהות |
| **bcrypt** | אלגוריתם גיבוב סיסמאות חד-כיווני |
| **AES-256** | אלגוריתם הצפנה סימטרי תעשייתי |
| **PWA** | אתר שמתנהג כאפליקציה נייטיב |
| **Service Worker** | proxy JS ב-background לcaching/push |
| **Migration** | קובץ שינויים מבוקרים בסכמת DB |
| **Serverless** | קוד שרץ On-Demand ללא שרת קבוע |
| **CDN** | רשת שרתי הפצה גיאוגרפית |
| **Hook** | פונקציית React לשימוש ב-state/lifecycle |
| **Scraping** | חילוץ נתונים מדפי HTML אוטומטית |
| **LLM** | מודל שפה גדול (AI כמו Gemini/GPT) |
| **ACID** | Atomicity, Consistency, Isolation, Durability |
| **XSS** | הזרקת JavaScript זדוני לאתר |
| **Brute Force** | ניסיון שיטתי של כל הסיסמאות האפשריות |
| **Context Window** | כמות הטקסט ש-AI יכול "לזכור" בשיחה |
| **VAPID** | מפתחות לאימות שרת Push Notifications |

---

*מסמך זה נכתב עבור הגשת הפרויקט ל-OptiPay — חיסכון חכם*
*גרסה: מאי 2026*
