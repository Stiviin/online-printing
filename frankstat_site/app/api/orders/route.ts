/**
 * app/api/orders/route.ts
 *
 * POST /api/orders  — create order + STK push
 * GET  /api/orders  — list the current user's orders
 *
 * payFull: false → 50% deposit  (PaymentType=DEPOSIT)
 * payFull: true  → full amount  (PaymentType=FULL)
 */

import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import prisma from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { initiateStkPush, normalisePhone } from "@/lib/mpesa";
import { calculatePrice, splitPayment, SERVICE_NAMES } from "@/lib/pricing";
import { put } from "@vercel/blob";

const orderSchema = z.object({
  service:   z.string().min(1),
  dimension: z.string().optional().nullable(),
  quantity:  z.coerce.number().int().min(1).max(10_000),
  paperType: z.string().optional().nullable(),
  notes:     z.string().max(1000).optional().nullable(),
  mpesa:     z.string().min(9).max(13),
  payFull:   z.preprocess((v) => v === true || v === "true" || v === "1", z.boolean()).default(false),
});

const ALLOWED_MIME = new Set([
  "image/jpeg","image/png","image/webp","image/gif",
  "application/pdf","application/postscript",
  "image/vnd.adobe.photoshop","application/octet-stream",
]);
const MAX_FILE_BYTES = 100 * 1024 * 1024;

// ── POST ──────────────────────────────────────────────────────────────────────
export async function POST(req: Request) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "You must be signed in to place an order." }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: session.sub },
    select: { isActive: true, isVerified: true },
  });
  if (!user?.isActive)   return NextResponse.json({ error: "Account not found or deactivated." }, { status: 401 });
  if (!user.isVerified)  return NextResponse.json({ error: "Please verify your email before placing an order.", code: "EMAIL_NOT_VERIFIED" }, { status: 403 });

  try {
    const fd = await req.formData();
    const fields = orderSchema.parse({
      service: fd.get("service"), dimension: fd.get("dimension"),
      quantity: fd.get("quantity"), paperType: fd.get("paperType"),
      notes: fd.get("notes"), mpesa: fd.get("mpesa"), payFull: fd.get("payFull"),
    });
    const imageFile = fd.get("imageFile") as File | null;

    // Artwork validation
    if (!imageFile || imageFile.size === 0) return NextResponse.json({ error: "Artwork file is required." }, { status: 400 });
    if (imageFile.size > MAX_FILE_BYTES)    return NextResponse.json({ error: "File too large. Maximum is 100 MB." }, { status: 400 });
    if (!ALLOWED_MIME.has(imageFile.type))  return NextResponse.json({ error: "Unsupported file type. JPG, PNG, PDF, AI, EPS, PSD only." }, { status: 400 });

    // Phone
    let phone: string;
    try { phone = normalisePhone(fields.mpesa); }
    catch { return NextResponse.json({ error: "Invalid M-Pesa number. Use format: 07XXXXXXXX" }, { status: 400 }); }

    // Server-side pricing
    const priceResult = calculatePrice(fields.service, fields.dimension, fields.quantity);
    if (!priceResult.ok) return NextResponse.json({ error: priceResult.error }, { status: 400 });
    const { totalPrice, unitPrice } = priceResult;
    const { depositAmount, balanceDue, chargeAmount, paymentType } = splitPayment(totalPrice, fields.payFull);
    if (chargeAmount < 1) return NextResponse.json({ error: "Charge amount too small." }, { status: 400 });

    // Upload artwork
    let artworkUrl: string;
    let artworkFilename = imageFile.name;
    try {
      const ext    = imageFile.name.split(".").pop() ?? "bin";
      const path   = `orders/${session.sub}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const buffer = Buffer.from(await imageFile.arrayBuffer());
      const blob   = await put(path, buffer, { access: "public", contentType: imageFile.type });
      artworkUrl   = blob.url;
    } catch (e) {
      console.error("[orders] upload error:", e);
      return NextResponse.json({ error: "Artwork upload failed. Please try again." }, { status: 500 });
    }

    // Create order + payment + status history atomically
    const order = await prisma.$transaction(async (tx) => {
      const created = await tx.orders.create({
        data: {
          userId: session.sub,
          serviceId: fields.service,
          serviceName: SERVICE_NAMES[fields.service as keyof typeof SERVICE_NAMES] ?? fields.service,
          dimensions: fields.dimension ?? null,
          quantity: fields.quantity,
          finishType: fields.paperType ?? null,
          specialNotes: fields.notes ?? null,
          unitPrice, totalPrice, depositAmount, balanceDue,
          artworkUrl, artworkFilename,
          mpesaPhone: phone,
          status: "PENDING_PAYMENT",
        },
      });
      await tx.payment.create({
        data: { orderId: created.id, type: paymentType, amount: chargeAmount, method: "M-Pesa", mpesaPhone: phone, status: "PENDING" },
      });
      await tx.orderStatusHistory.create({
        data: { orderId: created.id, fromStatus: null, toStatus: "PENDING_PAYMENT", changedBy: session.sub, note: "Order created" },
      });
      return created;
    });

    // STK Push
    try {
      const stk = await initiateStkPush({ phone, amount: chargeAmount, accountRef: order.id.slice(-8).toUpperCase(), description: "Frankstat order" });
      await prisma.orders.update({ where: { id: order.id }, data: { merchantRequestID: stk.MerchantRequestID, checkoutRequestID: stk.CheckoutRequestID } });
      await prisma.payment.updateMany({ where: { orderId: order.id, status: "PENDING" }, data: { checkoutRequestID: stk.CheckoutRequestID } });
      return NextResponse.json({ ok: true, orderId: order.id, chargeAmount, totalPrice, depositAmount, balanceDue, paymentType, customerMessage: stk.CustomerMessage }, { status: 201 });
    } catch (stkErr: any) {
      await prisma.orders.update({ where: { id: order.id }, data: { status: "PAYMENT_ERROR" } });
      await prisma.orderStatusHistory.create({ data: { orderId: order.id, fromStatus: "PENDING_PAYMENT", toStatus: "PAYMENT_ERROR", changedBy: "system", note: stkErr.message } });
      console.error("[orders] STK failed:", stkErr);
      return NextResponse.json({ error: stkErr.message ?? "M-Pesa prompt could not be sent. Please try again." }, { status: 502 });
    }
  } catch (err) {
    if (err instanceof ZodError) return NextResponse.json({ error: err.errors[0]?.message ?? "Invalid input." }, { status: 422 });
    console.error("[orders] error:", err);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}

// ── GET ───────────────────────────────────────────────────────────────────────
export async function GET(req: Request) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const page  = Math.max(1, parseInt(searchParams.get("page")  ?? "1",  10));
  const limit = Math.min(50, parseInt(searchParams.get("limit") ?? "20", 10));
  const skip  = (page - 1) * limit;

  const [orders, total] = await Promise.all([
    prisma.orders.findMany({
      where: { userId: session.sub },
      orderBy: { createdAt: "desc" },
      skip, take: limit,
      select: {
        id: true, serviceId: true, serviceName: true, dimensions: true,
        quantity: true, finishType: true, totalPrice: true, depositAmount: true,
        balanceDue: true, artworkUrl: true, artworkFilename: true, mpesaPhone: true,
        status: true, mpesaReceipt: true, createdAt: true, updatedAt: true,
        payments: { select: { id: true, type: true, amount: true, method: true, mpesaRef: true, status: true, createdAt: true }, orderBy: { createdAt: "desc" } },
      },
    }),
    prisma.orders.count({ where: { userId: session.sub } }),
  ]);

  return NextResponse.json({ orders, total, page, limit });
}
