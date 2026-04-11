/**
 * GET  /api/profile  — fetch current user's profile
 * PATCH /api/profile — update displayName and/or email
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAuth, getUserId }    from "@/server/auth/middleware";
import { prisma }                    from "@/lib/prisma";
import { z }                         from "zod";

const PatchSchema = z.object({
  displayName: z.string().min(1).max(100).optional(),
  email:       z.string().email().optional(),
}).refine((d) => d.displayName !== undefined || d.email !== undefined, {
  message: "לא הוזנו שינויים",
});

export async function GET(req: NextRequest) {
  const authError = await requireAuth(req);
  if (authError) return authError;
  const userId = getUserId(req);

  const user = await prisma.user.findUnique({
    where:  { id: userId },
    select: { id: true, email: true, displayName: true, avatarUrl: true, role: true, createdAt: true },
  });

  return NextResponse.json({ user });
}

export async function PATCH(req: NextRequest) {
  const authError = await requireAuth(req);
  if (authError) return authError;
  const userId = getUserId(req);

  let body: z.infer<typeof PatchSchema>;
  try {
    body = PatchSchema.parse(await req.json());
  } catch (err: any) {
    const msg = err?.errors?.[0]?.message ?? "הנתונים אינם תקינים";
    return NextResponse.json({ message: msg }, { status: 400 });
  }

  // Guard: email uniqueness
  if (body.email) {
    const conflict = await prisma.user.findFirst({
      where: { email: body.email.toLowerCase(), NOT: { id: userId } },
      select: { id: true },
    });
    if (conflict) {
      return NextResponse.json({ message: "כתובת הדוא״ל כבר בשימוש" }, { status: 409 });
    }
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(body.displayName !== undefined && { displayName: body.displayName }),
      ...(body.email       !== undefined && { email:       body.email.toLowerCase() }),
    },
    select: { id: true, email: true, displayName: true, avatarUrl: true, role: true },
  });

  return NextResponse.json({ user: updated });
}
