export const dynamic = 'force-dynamic'

/**
 * POST /api/push/subscribe   — register a push subscription
 * DELETE /api/push/subscribe — unregister (unsubscribe)
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth, getUserId } from "@/server/auth/middleware";
import { prisma }                 from "@/lib/prisma";

const SubSchema = z.object({
  endpoint:  z.string().url(),
  p256dhKey: z.string().min(10),
  authKey:   z.string().min(4),
  userAgent: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const authError = await requireAuth(req);
  if (authError) return authError;
  const userId = getUserId(req);

  let body: z.infer<typeof SubSchema>;
  try {
    body = SubSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ message: "קלט לא תקין" }, { status: 400 });
  }

  await prisma.pushSubscription.upsert({
    where:  { endpoint: body.endpoint },
    update: { isActive: true, p256dhKey: body.p256dhKey, authKey: body.authKey },
    create: {
      userId,
      endpoint:  body.endpoint,
      p256dhKey: body.p256dhKey,
      authKey:   body.authKey,
      userAgent: body.userAgent,
      isActive:  true,
    },
  });

  return NextResponse.json({ message: "ההרשמה להתראות נשמרה" });
}

export async function DELETE(req: NextRequest) {
  const authError = await requireAuth(req);
  if (authError) return authError;

  const endpoint = req.nextUrl.searchParams.get("endpoint");
  if (!endpoint) {
    return NextResponse.json({ message: "חסר endpoint" }, { status: 400 });
  }

  await prisma.pushSubscription.updateMany({
    where: { endpoint },
    data:  { isActive: false },
  });

  return NextResponse.json({ message: "ההרשמה בוטלה" });
}