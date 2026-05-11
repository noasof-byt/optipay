import { NextRequest, NextResponse } from "next/server";
import { verifyToken }  from "@/lib/auth";
import { prisma }       from "@/lib/prisma";

export async function GET(req: NextRequest) {
  // Read JWT from httpOnly cookie
  const token = req.cookies.get("optipay_token")?.value;

  if (!token) {
    return NextResponse.json({ message: "לא מחובר" }, { status: 401 });
  }

  let payload: ReturnType<typeof verifyToken>;
  try {
    payload = verifyToken(token);
  } catch {
    return NextResponse.json({ message: "פגה תקופת ההתחברות" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where:  { id: payload.userId },
    select: {
      id: true, email: true, displayName: true,
      avatarUrl: true, role: true,
      isLocked: true, isDeleted: true,
    },
  });

  if (!user || user.isDeleted || user.isLocked) {
    return NextResponse.json({ message: "הגישה נחסמה" }, { status: 403 });
  }

  return NextResponse.json({
    id:          user.id,
    email:       user.email,
    displayName: user.displayName,
    avatarUrl:   user.avatarUrl,
    role:        user.role,
  });
}
