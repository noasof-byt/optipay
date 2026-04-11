import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const Schema = z.object({
  email:    z.string().email(),
  password: z.string().min(1),
});

const MAX_ATTEMPTS = 10;
const LOCK_MINUTES = 30;

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

  // Generic message for non-existent users (prevent enumeration)
  if (!user || user.isDeleted) {
    return NextResponse.json({ message: "דוא\"ל או סיסמה שגויים" }, { status: 401 });
  }

  // Check lock
  if (user.isLocked) {
    const lockedUntil = user.lockedUntil;
    if (lockedUntil && lockedUntil > new Date()) {
      const minutesLeft = Math.ceil((lockedUntil.getTime() - Date.now()) / 60000);
      return NextResponse.json(
        { message: `החשבון נעול. נסה שוב בעוד ${minutesLeft} דקות.` },
        { status: 423 }
      );
    }
    // Lock expired — reset
    await prisma.user.update({
      where: { id: user.id },
      data:  { isLocked: false, failedLoginAttempts: 0, lockedUntil: null },
    });
  }

  const passwordOk = await bcrypt.compare(body.password, user.passwordHash);

  if (!passwordOk) {
    const attempts = user.failedLoginAttempts + 1;
    const lock     = attempts >= MAX_ATTEMPTS;

    await prisma.user.update({
      where: { id: user.id },
      data:  {
        failedLoginAttempts: attempts,
        isLocked:    lock,
        lockedUntil: lock ? new Date(Date.now() + LOCK_MINUTES * 60_000) : null,
      },
    });

    if (lock) {
      return NextResponse.json(
        { message: `יותר מדי ניסיונות כושלים. החשבון נעול ל-${LOCK_MINUTES} דקות.` },
        { status: 423 }
      );
    }

    const remaining = MAX_ATTEMPTS - attempts;
    return NextResponse.json(
      { message: `דוא"ל או סיסמה שגויים. נותרו ${remaining} ניסיונות.` },
      { status: 401 }
    );
  }

  // Success — reset counter
  await prisma.user.update({
    where: { id: user.id },
    data:  { failedLoginAttempts: 0, isLocked: false, lockedUntil: null, lastLoginAt: new Date() },
  });

  const token = jwt.sign(
    { userId: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET!,
    { expiresIn: (process.env.JWT_EXPIRES_IN ?? "7d") as unknown as number }
  );

  return NextResponse.json({
    token,
    user: {
      id:          user.id,
      email:       user.email,
      displayName: user.displayName,
      avatarUrl:   user.avatarUrl,
      role:        user.role,
    },
  });
}
