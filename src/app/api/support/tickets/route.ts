/**
 * POST /api/support/tickets — create a support ticket
 */
import { NextRequest, NextResponse } from "next/server";
import { z }                         from "zod";
import { requireAuth, getUserId }    from "@/server/auth/middleware";
import { prisma }                    from "@/lib/prisma";

const CreateTicketSchema = z.object({
  subject: z.string().min(1).max(500),
  message: z.string().min(10).max(5000),
});

export async function POST(req: NextRequest) {
  const authError = await requireAuth(req);
  if (authError) return authError;
  const userId = getUserId(req);

  let body: z.infer<typeof CreateTicketSchema>;
  try {
    body = CreateTicketSchema.parse(await req.json());
  } catch (err: any) {
    return NextResponse.json({ message: err.errors?.[0]?.message ?? "קלט לא תקין" }, { status: 400 });
  }

  const ticket = await prisma.supportTicket.create({
    data: { userId, subject: body.subject },
  });

  // Add the user's message as the first reply
  await prisma.ticketReply.create({
    data: { ticketId: ticket.id, authorId: userId, body: body.message },
  });

  return NextResponse.json({ id: ticket.id, status: ticket.status }, { status: 201 });
}
