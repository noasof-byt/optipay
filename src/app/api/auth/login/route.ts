export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma }                        from "@/lib/prisma";
import { signToken, comparePassword }    from "@/lib/auth";

const Schema = z.object({
  email:    z.string().email(),
  password: z.string().min(1),
});

const MAX_ATTEMPTS = 5;

export async function POST(req: NextRequest) {
  let body: z.infer<typeof Schema>;
  try {
    body = Schema.parse(await req.json());
  } catch {
    return NextResponse.json({ message: "פרטים לא תקינים" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where:  { email: body.email.toLowerCase() },
    select: {
      id: true, email: true, passwordHash: true,
      role: true, displayName: true, avatarUrl: true,
      isLocked: true, lockedUntil: true,
      failedLoginAttempts: true, isDeleted: true,
    },
  });

  // Generic error — never reveal whether email exists
  if (!user || user.isDeleted) {
    return NextResponse.json({ message: "דוא\"ל או סיסמה שגויים" }, { status: 401 });
  }

  // Account locked
  if (user.isLocked) {
    // Check if the lock has expired
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      return NextResponse.json(
        { message: "החשבון נעול. פנה לתמיכה" },
        { status: 423 }
      );
    }
    // Lock expired — reset automatically
    await prisma.user.update({
      where: { id: user.id },
      data:  { isLocked: false, failedLoginAttempts: 0, lockedUntil: null },
    });
  }

  const passwordOk = await comparePassword(body.password, user.passwordHash);

  if (!passwordOk) {
    const attempts = user.failedLoginAttempts + 1;
    const lock     = attempts >= MAX_ATTEMPTS;

    await prisma.user.update({
      where: { id: user.id },
      data:  {
        failedLoginAttempts: attempts,
        isLocked:    lock,
        lockedUntil: lock ? null : null, // permanent lock — requires support to unlock
      },
    });

    if (lock) {
      return NextResponse.json(
        { message: "החשבון נעול. פנה לתמיכה" },
        { status: 423 }
      );
    }

    return NextResponse.json({ message: "דוא\"ל או סיסמה שגויים" }, { status: 401 });
  }

  // Success — reset counter, update lastLoginAt
  await prisma.user.update({
    where: { id: user.id },
    data:  {
      failedLoginAttempts: 0,
      isLocked:    false,
      lockedUntil: null,
      lastLoginAt: new Date(),
    },
  });

  const token = signToken({ userId: user.id, email: user.email, role: user.role });

  const res = NextResponse.json({
    token, // kept in body for backward-compat with localStorage auth
    user: {
      id:          user.id,
      email:       user.email,
      displayName: user.displayName,
      avatarUrl:   user.avatarUrl,
      role:        user.role,
    },
  });

  // Set httpOnly cookie
  res.cookies.set("optipay_token", token, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === "production",
    sameSite: "lax",
    path:     "/",
    maxAge:   60 * 60 * 24 * 7, // 7 days
  });

  return res;
}