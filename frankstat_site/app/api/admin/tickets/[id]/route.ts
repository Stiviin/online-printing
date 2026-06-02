/**
 * PATCH /api/admin/tickets/:id — respond + close/resolve tickets
 */
import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import prisma from "@/lib/prisma";
import { requireAdmin, audit } from "@/lib/adminGuard";

type Ctx = { params: { id: string } };

const patchSchema = z.object({
  status:   z.enum(["OPEN","IN_PROGRESS","RESOLVED","CLOSED"]).optional(),
  response: z.string().min(1).max(5000).optional(),
}).strict();

export async function PATCH(req: Request, { params }: Ctx) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  try {
    const fields = patchSchema.parse(await req.json());
    const ticket = await prisma.supportTicket.findUnique({ where: { id: params.id }, select: { id: true, userId: true, subject: true } });
    if (!ticket) return NextResponse.json({ error: "Ticket not found." }, { status: 404 });

    const updateData: Record<string, unknown> = {};
    if (fields.status)   updateData.status = fields.status;
    if (fields.response) { updateData.response = fields.response; updateData.respondedBy = guard.session.sub; updateData.respondedAt = new Date(); }

    const updated = await prisma.supportTicket.update({ where: { id: params.id }, data: updateData as any });

    // Notify customer of response
    if (fields.response && ticket.userId) {
      await prisma.notification.create({
        data: { userId: ticket.userId, type: "TICKET_RESPONSE", title: "Support reply received", body: `Admin has responded to your ticket: "${ticket.subject}". Log in to read the reply.`, link: "/dashboard" },
      });
    }

    await audit({ adminId: guard.session.sub, action: "TICKET_UPDATED", entity: "SupportTicket", entityId: params.id, metadata: { status: fields.status }, req });
    return NextResponse.json({ ok: true, ticket: updated });
  } catch (err) {
    if (err instanceof ZodError) return NextResponse.json({ error: err.errors[0]?.message }, { status: 422 });
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
