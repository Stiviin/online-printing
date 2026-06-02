/**
 * GET   /api/admin/payments/:id  — payment detail
 * PATCH /api/admin/payments/:id  — correct errors, mark refunded, override status
 *
 * Admin can:
 *   - Change status → COMPLETED | FAILED | REFUNDED | CANCELLED
 *   - Correct amount (e.g. M-Pesa rounded differently)
 *   - Set mpesaRef manually for disputes
 *   - Add a failReason note
 *   - Trigger order status update when payment is refunded
 *
 * All changes are fully audited.
 */
import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import prisma from "@/lib/prisma";
import { requireAdmin, audit } from "@/lib/adminGuard";

type Ctx = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  status:     z.enum(["PENDING","COMPLETED","FAILED","REFUNDED","CANCELLED"]).optional(),
  amount:     z.number().positive().optional(),
  mpesaRef:   z.string().max(20).nullable().optional(),
  failReason: z.string().max(500).nullable().optional(),
  adminNote:  z.string().max(1000).optional(), // mandatory when issuing refund
}).strict();

export async function GET(_req: Request, { params }: Ctx) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const payment = await prisma.payment.findUnique({
    where: { id },
    include: { order: { include: { user: { select: { id: true, fullName: true, email: true } } } } },
  });
  if (!payment) return NextResponse.json({ error: "Payment not found." }, { status: 404 });
  return NextResponse.json({ payment });
}

export async function PATCH(req: Request, { params }: Ctx) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const { id } = await params;

  try {
    const body   = await req.json();
    const fields = patchSchema.parse(body);

    if (fields.status === "REFUNDED" && !fields.adminNote?.trim()) {
      return NextResponse.json({ error: "An admin note explaining the refund reason is required." }, { status: 422 });
    }

    const payment = await prisma.payment.findUnique({
      where: { id },
      select: { id: true, status: true, amount: true, orderId: true, type: true, order: { select: { status: true, userId: true, totalPrice: true } } },
    });
    if (!payment) return NextResponse.json({ error: "Payment not found." }, { status: 404 });

    const updateData: Record<string, unknown> = {};
    if (fields.status     !== undefined) updateData.status     = fields.status;
    if (fields.amount     !== undefined) updateData.amount     = fields.amount;
    if (fields.mpesaRef   !== undefined) updateData.mpesaRef   = fields.mpesaRef;
    if (fields.failReason !== undefined) updateData.failReason = fields.failReason;
    updateData.recordedBy = guard.session.sub; // mark who last touched this

    const updated = await prisma.$transaction(async tx => {
      const p = await tx.payment.update({ where: { id }, data: updateData as any });

      // If refunded → update order to REFUNDED + create REFUND payment record
      if (fields.status === "REFUNDED" && payment.status !== "REFUNDED") {
        await tx.orders.update({ where: { id: payment.orderId }, data: { status: "REFUNDED", balanceDue: 0 } });
        await tx.orderStatusHistory.create({
          data: { orderId: payment.orderId, fromStatus: payment.order.status as any, toStatus: "REFUNDED", changedBy: guard.session.sub, note: fields.adminNote },
        });
        // Notify customer
        if (payment.order.userId) {
          await tx.notification.create({
            data: { userId: payment.order.userId, type: "PAYMENT_RECEIVED", title: "Refund processed", body: `Your refund of KES ${(fields.amount ?? payment.amount).toLocaleString()} for order ${payment.orderId.slice(-8).toUpperCase()} has been processed. Allow 3-5 business days.`, link: "/dashboard/payments" },
          });
        }
      }

      // If corrected to COMPLETED and order was PAYMENT_FAILED → move to IN_PRODUCTION
      if (fields.status === "COMPLETED" && payment.status !== "COMPLETED") {
        if (["PAYMENT_FAILED","PAYMENT_ERROR","PENDING_PAYMENT"].includes(payment.order.status)) {
          await tx.orders.update({ where: { id: payment.orderId }, data: { status: "IN_PRODUCTION" } });
          await tx.orderStatusHistory.create({
            data: { orderId: payment.orderId, fromStatus: payment.order.status as any, toStatus: "IN_PRODUCTION", changedBy: guard.session.sub, note: `Payment corrected by admin: ${fields.adminNote ?? ""}` },
          });
          if (payment.order.userId) {
            await tx.notification.create({
              data: { userId: payment.order.userId, type: "PAYMENT_RECEIVED", title: "Payment confirmed", body: `Your payment for order ${payment.orderId.slice(-8).toUpperCase()} has been confirmed. Production has started!`, link: "/dashboard/orders" },
            });
          }
        }
      }

      return p;
    });

    await audit({ adminId: guard.session.sub, action: "PAYMENT_CORRECTED", entity: "Payment", entityId: id, metadata: { changes: Object.keys(updateData), prevStatus: payment.status, adminNote: fields.adminNote }, req });

    return NextResponse.json({ ok: true, payment: updated });
  } catch (err) {
    if (err instanceof ZodError) return NextResponse.json({ error: err.issues[0]?.message }, { status: 422 });
    console.error("[admin/payments PATCH]", err);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
