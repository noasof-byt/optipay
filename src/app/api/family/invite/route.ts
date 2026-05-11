export const dynamic = 'force-dynamic'

/**
 * POST /api/family/invite
 *
 * Invites a user by email to the caller's family group.
 * If the caller has no group yet, one is created automatically.
 * Sends an email notification via nodemailer.
 */
import { NextRequest, NextResponse } from "next/server";
import { z }                         from "zod";
import nodemailer                    from "nodemailer";
import { requireAuth, getUserId }    from "@/server/auth/middleware";
import { prisma }                    from "@/lib/prisma";

const InviteSchema = z.object({
  email: z.string().email("כתובת אימייל לא תקינה"),
});

export async function POST(req: NextRequest) {
  const authError = await requireAuth(req);
  if (authError) return authError;
  const userId = getUserId(req);

  let body: z.infer<typeof InviteSchema>;
  try {
    body = InviteSchema.parse(await req.json());
  } catch (err: any) {
    return NextResponse.json({ message: err.errors?.[0]?.message ?? "קלט לא תקין" }, { status: 400 });
  }

  const inviterEmail = body.email.toLowerCase();

  // Load the inviting user
  const inviter = await prisma.user.findUnique({
    where:  { id: userId },
    select: { id: true, displayName: true, email: true, familyGroupOwned: true },
  });
  if (!inviter) return NextResponse.json({ message: "משתמש לא נמצא" }, { status: 404 });

  // Prevent self-invite
  if (inviter.email.toLowerCase() === inviterEmail) {
    return NextResponse.json({ message: "לא ניתן להזמין את עצמך" }, { status: 400 });
  }

  // Find or create the caller's family group
  let group = inviter.familyGroupOwned;
  if (!group) {
    group = await prisma.familyGroup.create({
      data: {
        name:    `המשפחה של ${inviter.displayName ?? inviter.email}`,
        ownerId: userId,
      },
    });
    // Add owner as OWNER member
    await prisma.familyGroupMember.create({
      data: { familyGroupId: group.id, userId, role: "OWNER" },
    });
  }

  // Look up the invitee
  const invitee = await prisma.user.findUnique({
    where:  { email: inviterEmail },
    select: { id: true, email: true, displayName: true, familyMembership: true },
  });

  if (invitee) {
    // Already in this group?
    if (invitee.familyMembership?.familyGroupId === group.id) {
      return NextResponse.json({ message: "המשתמש כבר חבר בקבוצה" }, { status: 409 });
    }
    // Already in another group?
    if (invitee.familyMembership) {
      return NextResponse.json({ message: "המשתמש כבר שייך לקבוצה משפחתית אחרת" }, { status: 409 });
    }

    // Add to group
    await prisma.familyGroupMember.create({
      data: { familyGroupId: group.id, userId: invitee.id, role: "MEMBER" },
    });
  }

  // Send email notification
  try {
    const transporter = nodemailer.createTransport({
      host:   process.env.SMTP_HOST   ?? "smtp.gmail.com",
      port:   Number(process.env.SMTP_PORT ?? 587),
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    const inviterName = inviter.displayName ?? inviter.email;

    await transporter.sendMail({
      from:    `"OptiPay" <${process.env.SMTP_USER ?? "noreply@optipay.co.il"}>`,
      to:      body.email,
      subject: `${inviterName} הזמין/ה אותך לארנק משפחתי ב-OptiPay`,
      html: `
        <div dir="rtl" style="font-family:sans-serif;max-width:480px;margin:auto">
          <h2>הוזמנת לארנק משפחתי!</h2>
          <p>${inviterName} הוסיף/ה אותך לארנק המשפחתי שלו/שלה ב-OptiPay.</p>
          ${invitee
            ? `<p>הצטרפת לקבוצה — היכנס לאפליקציה כדי לראות את הפריטים המשותפים.</p>`
            : `<p>כדי להצטרף, הירשם ל-OptiPay עם כתובת האימייל הזו.</p>`
          }
          <a href="${process.env.NEXT_PUBLIC_BASE_URL ?? "https://optipay.co.il"}/login"
             style="display:inline-block;background:#1D3480;color:#fff;padding:12px 24px;border-radius:12px;text-decoration:none;font-weight:bold;margin-top:12px">
            כניסה לאפליקציה
          </a>
        </div>
      `,
    });
  } catch (mailErr) {
    // Email failure is non-critical — log and continue
    console.error("[family/invite] email failed:", mailErr);
  }

  return NextResponse.json({
    success: true,
    joined:  !!invitee,
    message: invitee ? "המשתמש נוסף לקבוצה" : "ההזמנה נשלחה בהצלחה",
  });
}