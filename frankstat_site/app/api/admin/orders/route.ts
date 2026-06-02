/**
 * GET /api/admin/orders
 * Admin/Staff — all orders with full detail, filtering, and pagination.
 *
 * Query params: page, limit, status, search
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
  const limit  = Math.min(100, parseInt(sp.get("limit") ?? "30", 10));
  const skip   = (page - 1) * limit;
  const status = sp.get("status")?.trim() || undefined;
  const search = sp.get("search")?.trim() || undefined;

  const where: Prisma.OrdersWhereInput = {};
  if (status) where.status = status as any;
  if (search) {
    where.OR = [
      { id:          { contains: search } },
      { serviceName: { contains: search } },
      { mpesaReceipt:{ contains: search } },
      { user: { fullName: { contains: search } } },
      { user: { email:    { contains: search } } },
      { user: { phone:    { contains: search } } },
    ];
  }

  const [orders, total] = await Promise.all([
    prisma.orders.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      select: {
        id: true,
        serviceName: true,
        dimensions: true,
        quantity: true,
        totalPrice: true,
        depositAmount: true,
        balanceDue: true,
        artworkUrl: true,
        status: true,
        assignedTo: true,
        expectedReadyAt: true,
        completedAt: true,
        specialNotes: true,
        discountCode: true,
        discountAmount: true,
        createdAt: true,
        updatedAt: true,
        user: {
          select: { id: true, fullName: true, email: true, phone: true },
        },
        payments: {
          select: {
            id: true, type: true, amount: true, method: true,
            mpesaRef: true, mpesaPhone: true, status: true,
            failReason: true, createdAt: true,
          },
          orderBy: { createdAt: "desc" },
        },
        statusHistory: {
          select: {
            id: true, fromStatus: true, toStatus: true,
            changedBy: true, note: true, createdAt: true,
          },
          orderBy: { createdAt: "desc" },
          take: 10,
        },
      },
    }),
    prisma.orders.count({ where }),
  ]);

  return NextResponse.json({ orders, total, page, limit });
}
