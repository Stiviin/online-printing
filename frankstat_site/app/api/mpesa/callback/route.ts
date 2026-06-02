/**
 * app/api/mpesa/callback/route.ts
 * Safaricom STK push callback. Must be publicly reachable.
 * Always returns 200 — Safaricom retries on any other status.
 *
 * On SUCCESS: marks payment COMPLETED, updates order status + balanceDue,
 *             writes StatusHistory + in-app Notification.
 * On FAILURE: marks payment FAILED, sets order PAYMENT_FAILED, notifies user.
 */

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCallbackMeta, type StkCallback } from "@/lib/mpesa";

const ACK = NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });

export async function POST(req: Request) {
  let body: unknown;
  try { body = await req.json(); }
  catch { return ACK; }

  const cb = (body as any)?.Body?.stkCallback as StkCallback | undefined;
  if (!cb?.CheckoutRequestID) { console.error("[callback] bad payload:", JSON.stringify(body)); return ACK; }

  const { CheckoutRequestID, ResultCode, ResultDesc, CallbackMetadata } = cb;

  // Match payment by checkoutRequestID
  const payment = await prisma.payment.findFirst({
    where: { checkoutRequestID: CheckoutRequestID },
    include: { order: { select: { id: true, userId: true, status: true, totalPrice: true, balanceDue: true } } },
  });
  if (!payment) { console.warn("[callback] unknown CheckoutRequestID:", CheckoutRequestID); return ACK; }

  const order = payment.order;

  if (ResultCode === 0) {
    // ── SUCCESS ──
    const items      = CallbackMetadata?.Item ?? [];
    const mpesaRef   = getCallbackMeta(items, "MpesaReceiptNumber") as string | undefined;
    const paidAmount = getCallbackMeta(items, "Amount")             as number | undefined;
    const mpesaPhone = getCallbackMeta(items, "PhoneNumber")        as string | undefined;

    const isFullyCovered = payment.type === "FULL" || payment.type === "BALANCE";
    const newBalanceDue  = isFullyCovered ? 0 : order.balanceDue;
    const currentStatus  = order.status;

    // Determine new order status
    let newOrderStatus = "IN_PRODUCTION";
    if (isFullyCovered && ["READY","DELIVERING"].includes(currentStatus)) newOrderStatus = "COMPLETED";

    await prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: payment.id },
        data: { status: "COMPLETED", mpesaRef: mpesaRef ?? null, mpesaPhone: mpesaPhone ? String(mpesaPhone) : payment.mpesaPhone, amount: paidAmount ?? payment.amount },
      });
      await tx.orders.update({
        where: { id: order.id },
        data: { status: newOrderStatus as any, balanceDue: newBalanceDue, mpesaReceipt: mpesaRef ?? null, ...(newOrderStatus === "COMPLETED" ? { completedAt: new Date() } : {}) },
      });
      await tx.orderStatusHistory.create({
        data: { orderId: order.id, fromStatus: currentStatus as any, toStatus: newOrderStatus as any, changedBy: "mpesa_callback", note: `Receipt: ${mpesaRef ?? "N/A"} · KES ${paidAmount ?? payment.amount}` },
      });
      if (order.userId) {
        await tx.notification.create({
          data: {
            userId: order.userId, type: "PAYMENT_RECEIVED",
            title: "Payment confirmed",
            body: `KES ${(paidAmount ?? payment.amount).toLocaleString()} received for order ${order.id.slice(-8).toUpperCase()}. ${isFullyCovered ? "Order fully paid!" : "Production has started."}`,
            link: `/dashboard/orders`,
          },
        });
      }
    });
    console.log(`[callback] SUCCESS order=${order.id} receipt=${mpesaRef}`);

  } else {
    // ── FAILURE ──
    await prisma.$transaction(async (tx) => {
      await tx.payment.update({ where: { id: payment.id }, data: { status: "FAILED", failReason: ResultDesc } });
      await tx.orders.update({ where: { id: order.id }, data: { status: "PAYMENT_FAILED" } });
      await tx.orderStatusHistory.create({
        data: { orderId: order.id, fromStatus: order.status as any, toStatus: "PAYMENT_FAILED", changedBy: "mpesa_callback", note: `${ResultDesc} (code ${ResultCode})` },
      });
      if (order.userId) {
        await tx.notification.create({
          data: {
            userId: order.userId, type: "PAYMENT_FAILED",
            title: "Payment failed",
            body: `M-Pesa payment for order ${order.id.slice(-8).toUpperCase()} was not completed. Reason: ${ResultDesc}. Please try again.`,
            link: `/dashboard/orders`,
          },
        });
      }
    });
    console.warn(`[callback] FAILED order=${order.id} reason=${ResultDesc}`);
  }

  return ACK;
}
