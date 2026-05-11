export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from "next/server";
import crypto      from "crypto";
import nodemailer  from "nodemailer";
import { z }       from "zod";
import { prisma }  from "@/lib/prisma";

const Schema = z.object({ email: z.string().email() });

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT ?? 587),
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});

export async function POST(req: NextRequest) {
  let body: z.infer<typeof Schema>;
  try {
    body = Schema.parse(await req.json());
  } catch {
    return NextResponse.json({ message: "דוא\"ל לא תקין" }, { status: 400 });
  }

  // Always respond 200 — never reveal whether the email exists
  const user = await prisma.user.findUnique({
    where:  { email: body.email.toLowerCase() },
    select: { id: true, displayName: true, isDeleted: true },
  });

  if (user && !user.isDeleted) {
    const rawToken  = crypto.randomBytes(32).toString("hex");
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
             style="display:inline-block;background:#1D3480;color:#fff;padding:12px 24px;border-radius:12px;text-decoration:none;font-weight:bold;">
            איפוס סיסמה
          </a>
          <p style="margin-top:24px;color:#6B7280;font-size:12px;">
            אם לא ביקשת איפוס סיסמה, התעלם ממייל זה.
          </p>
        </div>
      `,
    }).catch(() => {}); // Swallow SMTP errors — don't leak server config
  }

  return NextResponse.json({
    message: "אם הכתובת קיימת במערכת, נשלח מייל עם הוראות לאיפוס הסיסמה",
  });
}