import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma }          from "@/lib/prisma";
import { signToken, hashPassword } from "@/lib/auth";

const Schema = z.object({
  name:     z.string().min(2, "שם חייב להכיל לפחות 2 תווים").max(60),
  email:    z.string().email("כתובת דוא\"ל לא תקינה"),
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
    const message = err.errors?.[0]?.message ?? "פרטים לא תקינים";
    return NextResponse.json({ message }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({
    where:  { email: body.email.toLowerCase() },
    select: { id: true, isDeleted: true },
  });

  if (existing && !existing.isDeleted) {
    return NextResponse.json(
      { message: "כתובת הדוא\"ל כבר רשומה במערכת" },
      { status: 409 }
    );
  }

  const passwordHash = await hashPassword(body.password);

  const user = await prisma.user.create({
    data: {
      email:        body.email.toLowerCase(),
      displayName:  body.name,
      passwordHash,
      role:         "USER",
      failedLoginAttempts: 0,
      isLocked:     false,
    },
    select: { id: true, email: true, role: true, displayName: true, avatarUrl: true },
  });

  const token = signToken({ userId: user.id, email: user.email, role: user.role });

  const res = NextResponse.json(
    {
      token, // kept in body for backward-compat with localStorage auth
      user: {
        id:          user.id,
        email:       user.email,
        displayName: user.displayName,
        avatarUrl:   user.avatarUrl,
        role:        user.role,
      },
    },
    { status: 201 }
  );

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
