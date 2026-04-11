/**
 * POST /api/profile/password
 * Change the authenticated user's password.
 * Validates the current password before updating.
 */
import { NextRequest, NextResponse } from "next/server";
import bcrypt                         from "bcryptjs";
import { requireAuth, getUserId }     from "@/server/auth/middleware";
import { prisma }                     from "@/lib/prisma";
import { z }                          from "zod";

const Schema = z.object({
  currentPassword: z.string().min(1),
  newPassword:     z.string().min(8, "הסיסמה החדשה חייבת לכלול לפחות 8 תווים"),
});

export async function POST(req: NextRequest) {
  const authError = await requireAuth(req);
  if (authError) return authError;
  const userId = getUserId(req);

  let body: z.infer<typeof Schema>;
  try {
    body = Schema.parse(await req.json());
  } catch (err: any) {
    const msg = err?.errors?.[0]?.message ?? "הנתונים אינם תקינים";
    return NextResponse.json({ message: msg }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where:  { id: userId },
    select: { passwordHash: true },
  });
  if (!user) return NextResponse.json({ message: "משתמש לא נמצא" }, { status: 404 });

  const isValid = await bcrypt.compare(body.currentPassword, user.passwordHash);
  if (!isValid) {
    return NextResponse.json({ message: "הסיסמה הנוכחית שגויה" }, { status: 400 });
  }

  if (body.currentPassword === body.newPassword) {
    return NextResponse.json({ message: "הסיסמה החדשה חייבת להיות שונה מהנוכחית" }, { status: 400 });
  }

  const newHash = await bcrypt.hash(body.newPassword, 12);
  await prisma.user.update({
    where: { id: userId },
    data:  { passwordHash: newHash },
  });

  return NextResponse.json({ message: "הסיסמה עודכנה בהצלחה" });
}
