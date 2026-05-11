import { NextRequest, NextResponse } from "next/server";
import crypto     from "crypto";
import { z }      from "zod";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";

const Schema = z.object({
  token:    z.string().min(1),
  password: z
    .string()
    .min(8, "הסיסמה חייבת להכיל לפחות 8 תווים")
    .regex(/[A-Z]/, "הסיסמה חייבת להכיל לפחות אות גדולה אחת באנגלית")
    .regex(/[0-9]/, "הסיסמה חייבת להכיל לפחות ספרה אחת"),
});

export async function POST(req: NextRequest) {
  let body: z.infer<typeof Schema>;
  try {
    body = Schema.parse(await req.json());
  } catch (err: any) {
    const message = err.errors?.[0]?.message ?? "קלט לא תקין";
    return NextResponse.json({ message }, { status: 400 });
  }

  const tokenHash = crypto.createHash("sha256").update(body.token).digest("hex");

  const record = await prisma.passwordResetToken.findUnique({
    where:  { tokenHash },
    select: { id: true, userId: true, expiresAt: true, usedAt: true },
  });

  if (!record || record.usedAt || record.expiresAt < new Date()) {
    return NextResponse.json(
      { message: "הקישור לא תקין או פג תוקפו" },
      { status: 400 }
    );
  }

  const passwordHash = await hashPassword(body.password);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data:  {
        passwordHash,
        failedLoginAttempts: 0,
        isLocked:    false,
        lockedUntil: null,
      },
    }),
    // Mark token as used
    prisma.passwordResetToken.update({
      where: { id: record.id },
      data:  { usedAt: new Date() },
    }),
    // Invalidate all active sessions
    prisma.userSession.deleteMany({ where: { userId: record.userId } }),
  ]);

  return NextResponse.json({ message: "הסיסמה עודכנה בהצלחה. ניתן להתחבר עם הסיסמה החדשה." });
}
