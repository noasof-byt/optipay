import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import nodemailer from "nodemailer";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const RequestSchema = z.object({ email: z.string().email() });
const ResetSchema   = z.object({ token: z.string(), password: z.string().min(8) });

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT ?? 587),
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});

// POST /api/auth/reset-password  → request reset link
// PUT  /api/auth/reset-password  → confirm with token + new password

export async function POST(req: NextRequest) {
  let body: z.infer<typeof RequestSchema>;
  try {
    body = RequestSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ message: "דוא\"ל לא תקין" }, { status: 400 });
  }

  // Always respond 200 to prevent email enumeration
  const user = await prisma.user.findUnique({
    where: { email: body.email.toLowerCase() },
    select: { id: true, displayName: true },
  });

  if (user) {
    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash, expiresAt },
    });

    const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL}/reset-password?token=${rawToken}`;

    await transporter.sendMail({
      from:    process.env.FROM_EMAIL,
      to:      body.email,
      subject: "OptiPay – איפוס סיסמה",
      html: `
        <div dir="rtl" style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto">
          <h2>שלום ${user.displayName ?? ""},</h2>
          <p>קיבלנו בקשה לאיפוס הסיסמה שלך ב-OptiPay.</p>
          <p>לחץ על הכפתור הבא לאיפוס הסיסמה (תוקף שעה אחת):</p>
          <a href="${resetUrl}"
             style="display:inline-block;background:#2563EB;color:#fff;padding:12px 24px;border-radius:12px;text-decoration:none;font-weight:bold;">
            איפוס סיסמה
          </a>
          <p style="margin-top:24px;color:#6B7280;font-size:12px;">
            אם לא ביקשת איפוס סיסמה, התעלם ממייל זה.
          </p>
        </div>
      `,
    }).catch(() => {}); // Don't leak SMTP errors
  }

  return NextResponse.json({ message: "אם הכתובת קיימת, נשלח מייל עם הוראות" });
}

export async function PUT(req: NextRequest) {
  let body: z.infer<typeof ResetSchema>;
  try {
    body = ResetSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ message: "קלט לא תקין" }, { status: 400 });
  }

  const tokenHash = crypto.createHash("sha256").update(body.token).digest("hex");

  const record = await prisma.passwordResetToken.findUnique({
    where:  { tokenHash },
    select: { id: true, userId: true, expiresAt: true, usedAt: true },
  });

  if (!record || record.usedAt || record.expiresAt < new Date()) {
    return NextResponse.json({ message: "הקישור לא תקין או פג תוקף" }, { status: 400 });
  }

  const { default: bcrypt } = await import("bcryptjs");
  const passwordHash = await bcrypt.hash(body.password, 12);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data:  { passwordHash, failedLoginAttempts: 0, isLocked: false, lockedUntil: null },
    }),
    prisma.passwordResetToken.update({
      where: { id: record.id },
      data:  { usedAt: new Date() },
    }),
    // Invalidate all sessions
    prisma.userSession.deleteMany({ where: { userId: record.userId } }),
  ]);

  return NextResponse.json({ message: "הסיסמה עודכנה בהצלחה" });
}
