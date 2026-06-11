/**
 * PATCH /api/admin/orders/:id — admin can update ANY order field (except payment fields)
 * GET   /api/admin/orders/:id — single order detail
 */
import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import prisma from "@/lib/prisma";
import { requireAdmin, audit } from "@/lib/adminGuard";

type Ctx = { params: Promise<{ id: string }> };

const ALL_STATUSES = ["PENDING_PAYMENT","IN_PRODUCTION","QUALITY_CHECK","READY","DELIVERING","COMPLETED","PAYMENT_FAILED","PAYMENT_ERROR","CANCELLED","REFUNDED"] as const;

const patchSchema = z.object({
  status:          z.enum(ALL_STATUSES).optional(),
  assignedTo:      z.string().max(100).nullable().optional(),
  expectedReadyAt: z.string().nullable().optional(),  // ISO-8601 datetime
  specialNotes:    z.string().max(2000).nullable().optional(),
  discountCode:    z.string().max(50).nullable().optional(),
  discountAmount:  z.number().min(0).nullable().optional(),
  note:            z.string().max(500).nullable().optional(),
}).strict();

export async function GET(_req: Request, { params }: Ctx) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const order = await prisma.orders.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, fullName: true, email: true, phone: true } },
      payments: { orderBy: { createdAt: "desc" } },
      statusHistory: { orderBy: { createdAt: "desc" } },
      attachments: true,
    },
  });
  if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });
  return NextResponse.json({ order });
}

export async function PATCH(req: Request, { params }: Ctx) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const { id } = await params;

  try {
    const body   = await req.json();
    const fields = patchSchema.parse(body);

    const order = await prisma.orders.findUnique({ where: { id }, select: { id: true, status: true } });
    if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });

    const updateData: Record<string, unknown> = {};
    if (fields.status          !== undefined) updateData.status          = fields.status;
    if (fields.assignedTo      !== undefined) updateData.assignedTo      = fields.assignedTo;
    if (fields.expectedReadyAt !== undefined) updateData.expectedReadyAt = fields.expectedReadyAt ? new Date(fields.expectedReadyAt) : null;
    if (fields.specialNotes    !== undefined) updateData.specialNotes    = fields.specialNotes;
    if (fields.discountCode    !== undefined) updateData.discountCode    = fields.discountCode;
    if (fields.discountAmount  !== undefined) updateData.discountAmount  = fields.discountAmount;
    if (fields.status === "COMPLETED") updateData.completedAt = new Date();
    if (fields.status === "REFUNDED") { updateData.completedAt = new Date(); updateData.balanceDue = 0; }

    if (Object.keys(updateData).length === 0) return NextResponse.json({ error: "Nothing to update." }, { status: 400 });

    const updated = await prisma.$transaction(async tx => {
      const o = await tx.orders.update({ where: { id }, data: updateData as any });

      if (fields.status && fields.status !== order.status) {
        await tx.orderStatusHistory.create({
          data: { orderId: id, fromStatus: order.status as any, toStatus: fields.status as any, changedBy: guard.session.sub, note: fields.note ?? "Admin update" },
        });
        // Notify customer
        if (o.userId) {
          const notifMap: Record<string, { title: string; body: string }> = {
            COMPLETED:     { title: "Order completed",    body: `Your order ${id.slice(-8).toUpperCase()} has been marked as completed.` },
            CANCELLED:     { title: "Order cancelled",    body: `Your order ${id.slice(-8).toUpperCase()} has been cancelled. Contact us for details.` },
            REFUNDED:      { title: "Refund issued",      body: `A refund has been processed for order ${id.slice(-8).toUpperCase()}.` },
            IN_PRODUCTION: { title: "Production started", body: `Your order ${id.slice(-8).toUpperCase()} is now in production.` },
            READY:         { title: "Order ready",        body: `Your order ${id.slice(-8).toUpperCase()} is ready for collection!` },
          };
          const msg = notifMap[fields.status];
          if (msg) await tx.notification.create({ data: { userId: o.userId, type: "GENERAL", title: msg.title, body: msg.body, link: "/dashboard/orders" } });
        }
      }
      return o;
    });

    await audit({ adminId: guard.session.sub, action: "ORDER_UPDATED", entity: "Order", entityId: id, metadata: { changes: Object.keys(updateData), prev: order.status }, req });

    return NextResponse.json({ ok: true, order: updated });
  } catch (err) {
    if (err instanceof ZodError) return NextResponse.json({ error: err.issues[0]?.message }, { status: 422 });
    console.error("[admin/orders PATCH]", err);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const { id } = await params;

  const order = await prisma.orders.findUnique({ where: { id }, select: { id: true, status: true } });
  if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });

  const completedPayments = await prisma.payment.count({
    where: { orderId: id, status: { in: ["COMPLETED", "REFUNDED"] } },
  });
  if (completedPayments > 0)
    return NextResponse.json({ error: "Cannot delete an order with completed payments. Cancel or refund it instead." }, { status: 422 });

  await prisma.$transaction(async tx => {
    await tx.payment.deleteMany({ where: { orderId: id } });
    await tx.orders.delete({ where: { id } });
  });

  await audit({ adminId: guard.session.sub, action: "ORDER_DELETED", entity: "Order", entityId: id, metadata: { status: order.status }, req: _req });

  return NextResponse.json({ ok: true });
}
