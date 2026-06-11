/**
 * app/api/staff/orders/[id]/route.ts
 *
 * PATCH /api/staff/orders/:id
 *
 * Staff-only. Allows editing the OPERATIONAL fields of an order:
 *   - status          (from allowed transitions only)
 *   - assignedTo      (which staff member is handling it)
 *   - expectedReadyAt (production ETA)
 *   - specialNotes    (append internal note)
 *   - note            (note to attach to the status-history entry)
 *
 * CANNOT edit:
 *   - Any pricing fields (totalPrice, depositAmount, balanceDue, unitPrice)
 *   - Any payment fields (mpesaReceipt, checkoutRequestID, etc.)
 *   - artworkUrl, userId, serviceId, quantity
 *   - Customer personal data
 *
 * GET /api/staff/orders/:id — single order detail
 */

import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import prisma from "@/lib/prisma";
import { requireStaff, audit } from "@/lib/adminGuard";
import { sendOrderReadyEmail } from "@/lib/email";

// ── Valid status transitions for staff ────────────────────────────────────────
// Staff may only move an order FORWARD through production.
// They cannot touch payment statuses (PAYMENT_FAILED, PAYMENT_ERROR)
// or issue refunds — those are admin-only.
const STAFF_ALLOWED_STATUSES = [
  "IN_PRODUCTION",
  "QUALITY_CHECK",
  "READY",
  "DELIVERING",
  "COMPLETED",
  "CANCELLED",   // staff can cancel an order that hasn't been paid yet
] as const;

// Which statuses a staff member can transition FROM → TO
// Key = current status, Value = statuses they may set it to
const VALID_TRANSITIONS: Record<string, string[]> = {
  PENDING_PAYMENT: ["CANCELLED"],
  IN_PRODUCTION:   ["QUALITY_CHECK", "CANCELLED"],
  QUALITY_CHECK:   ["IN_PRODUCTION", "READY", "CANCELLED"],
  READY:           ["DELIVERING", "COMPLETED", "CANCELLED"],
  DELIVERING:      ["COMPLETED", "CANCELLED"],
  PAYMENT_FAILED:  ["CANCELLED"],
  PAYMENT_ERROR:   ["CANCELLED"],
  // Terminal states — staff cannot move out of these
  COMPLETED:       [],
  CANCELLED:       [],
  REFUNDED:        [],
};

// ── Input schema ──────────────────────────────────────────────────────────────
const patchSchema = z.object({
  status:          z.enum(["IN_PRODUCTION","QUALITY_CHECK","READY","DELIVERING","COMPLETED","CANCELLED"]).optional(),
  assignedTo:      z.string().max(100).optional().nullable(),
  expectedReadyAt: z.string().datetime().optional().nullable(),  // ISO-8601
  note:            z.string().max(500).optional().nullable(),   // attaches to status history
  specialNotes:    z.string().max(2000).optional().nullable(),  // appended to order notes
}).strict(); // reject unknown keys — prevents accidental price edits

// ─────────────────────────────────────────────────────────────────────────────
// GET — single order detail
// ─────────────────────────────────────────────────────────────────────────────
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const guard = await requireStaff();
  if (!guard.ok) return guard.response;

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

// ─────────────────────────────────────────────────────────────────────────────
// PATCH — update operational fields only
// ─────────────────────────────────────────────────────────────────────────────
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const guard = await requireStaff();
  if (!guard.ok) return guard.response;
  const { session } = guard;

  // Parse body
  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 }); }

  let fields: z.infer<typeof patchSchema>;
  try { fields = patchSchema.parse(body); }
  catch (err) {
    if (err instanceof ZodError)
      return NextResponse.json({ error: err.errors[0]?.message ?? "Invalid input." }, { status: 422 });
    throw err;
  }

  // Fetch current order
  const order = await prisma.orders.findUnique({
    where: { id },
    select: { id: true, status: true, completedAt: true },
  });
  if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });

  // Validate status transition if status is being changed
  if (fields.status && fields.status !== order.status) {
    const allowed = VALID_TRANSITIONS[order.status] ?? [];
    if (!allowed.includes(fields.status)) {
      return NextResponse.json(
        { error: `Cannot move order from "${order.status}" to "${fields.status}". Invalid transition.` },
        { status: 422 }
      );
    }
  }

  // Build update payload — only operational fields, never financial
  const updateData: Record<string, unknown> = {};
  if (fields.status          !== undefined) updateData.status          = fields.status;
  if (fields.assignedTo      !== undefined) updateData.assignedTo      = fields.assignedTo;
  if (fields.expectedReadyAt !== undefined) updateData.expectedReadyAt = fields.expectedReadyAt ? new Date(fields.expectedReadyAt) : null;
  if (fields.specialNotes    !== undefined) updateData.specialNotes    = fields.specialNotes;
  if (fields.status === "COMPLETED" && !order.completedAt) updateData.completedAt = new Date();

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: "No valid fields to update." }, { status: 400 });
  }

  // Run update + status history in a transaction
  const updated = await prisma.$transaction(async (tx) => {
    const o = await tx.orders.update({
      where: { id },
      data: updateData as any,
      select: {
        id: true, status: true, assignedTo: true,
        expectedReadyAt: true, specialNotes: true,
        completedAt: true, updatedAt: true,
      },
    });

    // Write status history if status changed
    if (fields.status && fields.status !== order.status) {
      await tx.orderStatusHistory.create({
        data: {
          orderId:    id,
          fromStatus: order.status as any,
          toStatus:   fields.status as any,
          changedBy:  session.sub,
          note:       fields.note ?? null,
        },
      });

      // Notify the customer
      const fullOrder = await tx.orders.findUnique({
        where: { id },
        select: { userId: true, id: true, serviceName: true, user: { select: { email: true, fullName: true } } },
      });
      if (fullOrder?.userId) {
        const statusMessages: Record<string, { title: string; body: string; type: any }> = {
          IN_PRODUCTION: { type: "ORDER_CONFIRMED",  title: "Production started",  body: `Your order ${id.slice(-8).toUpperCase()} is now in production!` },
          QUALITY_CHECK: { type: "GENERAL",          title: "Quality check",       body: `Your order ${id.slice(-8).toUpperCase()} is being inspected before dispatch.` },
          READY:         { type: "ORDER_READY",      title: "Order ready",         body: `Your order ${id.slice(-8).toUpperCase()} is ready for collection!` },
          DELIVERING:    { type: "ORDER_DELIVERING", title: "Out for delivery",    body: `Your order ${id.slice(-8).toUpperCase()} is on its way!` },
          COMPLETED:     { type: "ORDER_COMPLETED",  title: "Order completed",     body: `Your order ${id.slice(-8).toUpperCase()} has been delivered. Thank you!` },
          CANCELLED:     { type: "GENERAL",          title: "Order cancelled",     body: `Your order ${id.slice(-8).toUpperCase()} has been cancelled. Contact us if this is unexpected.` },
        };
        const msg = statusMessages[fields.status];
        if (msg) {
          await tx.notification.create({
            data: {
              userId: fullOrder.userId,
              type:   msg.type,
              title:  msg.title,
              body:   msg.body,
              link:   "/dashboard/orders",
            },
          });
        }
      }
    }

    return o;
  });

  // Send "order ready" email when status moves to READY (fire-and-forget)
  if (fields.status === "READY" && order.status !== "READY") {
    prisma.orders.findUnique({
      where: { id },
      select: { serviceName: true, user: { select: { email: true, fullName: true } } },
    }).then(o => {
      if (o?.user?.email) {
        sendOrderReadyEmail({
          to:          o.user.email,
          fullName:    o.user.fullName,
          orderId:     id,
          serviceName: o.serviceName,
        }).catch(e => console.error("[order-ready email]", e));
      }
    }).catch(e => console.error("[order-ready email fetch]", e));
  }

  // Audit log (non-critical, outside transaction)
  audit({ adminId: session.sub, action: "ORDER_UPDATED", entity: "Order", entityId: id, metadata: { changes: updateData, previousStatus: order.status } });

  return NextResponse.json({ ok: true, order: updated });
}
