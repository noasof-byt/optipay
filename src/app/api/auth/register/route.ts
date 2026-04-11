import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const Schema = z.object({
  displayName: z.string().min(2).max(60),
  email:       z.string().email(),
  password:    z.string().min(8).max(128),
});

export async function POST(req: NextRequest) {
  let body: z.infer<typeof Schema>;
  try {
    body = Schema.parse(await req.json());
  } catch {
    return NextResponse.json({ message: "פרטים לא תקינים" }, { status: 400 });
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

  const passwordHash = await bcrypt.hash(body.password, 12);

  const user = await prisma.user.create({
    data: {
      email:        body.email.toLowerCase(),
      displayName:  body.displayName,
      passwordHash,
    },
    select: { id: true, email: true, role: true, displayName: true },
  });

  const token = jwt.sign(
    { userId: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET!,
    { expiresIn: (process.env.JWT_EXPIRES_IN ?? "7d") as unknown as number }
  );

  return NextResponse.json(
    { token, user: { id: user.id, email: user.email, displayName: user.displayName } },
    { status: 201 }
  );
}
