/**
 * app/api/orders/[id]/pay-balance/route.ts
 *
 * POST /api/orders/:id/pay-balance
 * Body: { mpesa?: string }  — optional override phone number
 *
 * Initiates a second STK push for the remaining balance on an order
 * that was paid with a 50% deposit. Also handles retry if the first
 * STK push had PAYMENT_ERROR / PAYMENT_FAILED status.
 *
 * Guards:
 *   - Must be authenticated
 *   - Order must belong to the current user (or user is ADMIN/STAFF)
 *   - Order must be in IN_PRODUCTION, QUALITY_CHECK, or READY status
 *     (i.e. deposit confirmed, work is underway)
 *   - balanceDue must be > 0
 */

import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import prisma from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { initiateStkPush, normalisePhone } from "@/lib/mpesa";

const bodySchema = z.object({
  mpesa: z.string().min(9).max(13).optional(),
});

// Statuses where balance payment is valid
const BALANCE_ALLOWED_STATUSES = ["IN_PRODUCTION", "QUALITY_CHECK", "READY", "DELIVERING"];

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { id: orderId } = await params;

  // Fetch order with existing payments
  const order = await prisma.orders.findUnique({
    where: { id: orderId },
    include: {
      payments: {
        where: { status: "COMPLETED" },
        select: { amount: true },
      },
    },
  });

  if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });

  // Ownership check — customers can only pay their own orders
  const isPrivileged = ["ADMIN", "STAFF"].includes(session.role);
  if (!isPrivileged && order.userId !== session.sub) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  // Status check
  if (!BALANCE_ALLOWED_STATUSES.includes(order.status)) {
    return NextResponse.json(
      { error: `Balance payment is not available for orders in "${order.status}" status.` },
      { status: 400 }
    );
  }

  // Check there is actually a balance to pay
  if (order.balanceDue <= 0) {
    return NextResponse.json({ error: "This order has no outstanding balance." }, { status: 400 });
  }

  // Check no pending balance payment already in flight
  const inFlight = await prisma.payment.findFirst({
    where: { orderId, type: "BALANCE", status: "PENDING" },
  });
  if (inFlight) {
    return NextResponse.json(
      { error: "A balance payment is already pending. Please complete or wait for it to expire before retrying." },
      { status: 409 }
    );
  }

  // Determine phone
  let json: Record<string, unknown> = {};
  try { json = await req.json(); } catch { /* body is optional */ }
  const { mpesa: mpesaOverride } = bodySchema.parse(json);

  let phone: string;
  try {
    phone = normalisePhone(mpesaOverride ?? order.mpesaPhone);
  } catch {
    return NextResponse.json({ error: "Invalid M-Pesa number." }, { status: 400 });
  }

  const balanceDue = order.balanceDue;

  // Create a PENDING balance payment record
  const payment = await prisma.payment.create({
    data: {
      orderId,
      type:       "BALANCE",
      amount:     balanceDue,
      method:     "M-Pesa",
      mpesaPhone: phone,
      status:     "PENDING",
    },
  });

  // Initiate STK push
  try {
    const stk = await initiateStkPush({
      phone,
      amount:      balanceDue,
      accountRef:  orderId.slice(-8).toUpperCase(),
      description: "Frankstat balance",
    });

    // Store checkoutRequestID on the payment so the callback can match it
    await prisma.payment.update({
      where: { id: payment.id },
      data:  { checkoutRequestID: stk.CheckoutRequestID },
    });

    return NextResponse.json({
      ok:             true,
      paymentId:      payment.id,
      balanceDue,
      customerMessage: stk.CustomerMessage,
    });
  } catch (stkErr: any) {
    // Delete the pending record so the user can retry cleanly
    await prisma.payment.delete({ where: { id: payment.id } }).catch(() => {});
    console.error("[pay-balance] STK failed:", stkErr);
    return NextResponse.json(
      { error: stkErr.message ?? "M-Pesa prompt could not be sent. Please try again." },
      { status: 502 }
    );
  }
}
