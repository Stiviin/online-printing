/**
 * app/api/admin/payments/route.ts
 * GET /api/admin/payments — ADMIN/STAFF only, all payments with filtering
 *
 * Query: page, limit, status, type, userId, search, from, to
 */
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { requireStaff } from "@/lib/adminGuard";

export async function GET(req: Request) {
  const guard = await requireStaff();
  if (!guard.ok) return guard.response;

  const sp     = new URL(req.url).searchParams;
  const page   = Math.max(1, parseInt(sp.get("page")  ?? "1",  10));
  const limit  = Math.min(200, parseInt(sp.get("limit") ?? "50", 10));
  const skip   = (page - 1) * limit;
  const status = sp.get("status") ?? undefined;
  const type   = sp.get("type")   ?? undefined;
  const userId = sp.get("userId") ?? undefined;
  const search = sp.get("search")?.trim() ?? undefined;
  const from   = sp.get("from") ?? undefined;
  const to     = sp.get("to")   ?? undefined;

  const where: Prisma.PaymentWhereInput = {};
  if (status) where.status = status as any;
  if (type)   where.type   = type   as any;
  if (userId) where.order  = { userId };
  if (from || to) where.createdAt = { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) };
  if (search) {
    where.OR = [
      { mpesaRef: { contains: search } },
      { order: { id: { contains: search } } },
      { order: { user: { email:    { contains: search } } } },
      { order: { user: { phone:    { contains: search } } } },
      { order: { user: { fullName: { contains: search } } } },
    ];
  }

  const [payments, total, filtered, platform] = await Promise.all([
    prisma.payment.findMany({
      where, orderBy: { createdAt: "desc" }, skip, take: limit,
      select: {
        id: true, type: true, amount: true, method: true,
        mpesaRef: true, mpesaPhone: true, status: true,
        failReason: true, recordedBy: true, checkoutRequestID: true,
        createdAt: true, updatedAt: true,
        order: {
          select: {
            id: true, serviceName: true, totalPrice: true,
            depositAmount: true, balanceDue: true, status: true,
            user: { select: { id: true, fullName: true, email: true, phone: true } },
          },
        },
      },
    }),
    prisma.payment.count({ where }),
    prisma.payment.aggregate({ where: { ...where, status: "COMPLETED" }, _sum: { amount: true }, _count: { id: true } }),
    prisma.payment.aggregate({ where: { status: "COMPLETED" }, _sum: { amount: true }, _count: { id: true } }),
  ]);

  return NextResponse.json({
    payments, total, page, limit,
    filteredStats:  { totalCollected: filtered._sum.amount ?? 0, totalTransactions: filtered._count.id ?? 0 },
    platformStats:  { totalCollected: platform._sum.amount ?? 0, totalTransactions: platform._count.id ?? 0 },
  });
}
