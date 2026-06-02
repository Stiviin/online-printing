/**
 * app/api/staff/orders/route.ts
 *
 * GET /api/staff/orders
 *
 * Returns all orders with customer details, most recent first.
 * Staff and Admin only — customers get 403.
 *
 * Query params:
 *   page     default 1
 *   limit    default 30, max 100
 *   status   filter by OrderStatus enum value
 *   search   searches customer name, email, phone, order id, service name
 */

import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { requireStaff } from "@/lib/adminGuard";

export async function GET(req: Request) {
  // ── Auth & role guard ────────────────────────────────────────────────────
  const guard = await requireStaff();
  if (!guard.ok) return guard.response;

  // ── Query params ─────────────────────────────────────────────────────────
  const sp     = new URL(req.url).searchParams;
  const page   = Math.max(1, parseInt(sp.get("page")  ?? "1",   10));
  const limit  = Math.min(100, parseInt(sp.get("limit") ?? "30",  10));
  const skip   = (page - 1) * limit;
  const status = sp.get("status")?.trim() || undefined;
  const search = sp.get("search")?.trim() || undefined;

  // ── Build where clause ───────────────────────────────────────────────────
  const where: Prisma.OrdersWhereInput = {};
  if (status) where.status = status as any;
  if (search) {
    where.OR = [
      { id:          { contains: search } },
      { serviceName: { contains: search } },
      { user: { fullName: { contains: search } } },
      { user: { email:    { contains: search } } },
      { user: { phone:    { contains: search } } },
    ];
  }

  // ── Fetch orders, count, and status breakdown in parallel ────────────────
  const [orders, total, statusCounts] = await Promise.all([
    prisma.orders.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      select: {
        id: true,
        serviceId: true,
        serviceName: true,
        dimensions: true,
        quantity: true,
        finishType: true,
        specialNotes: true,
        unitPrice: true,
        totalPrice: true,
        depositAmount: true,
        balanceDue: true,
        artworkUrl: true,
        artworkFilename: true,
        mpesaPhone: true,
        mpesaReceipt: true,
        status: true,
        assignedTo: true,
        expectedReadyAt: true,
        completedAt: true,
        createdAt: true,
        updatedAt: true,
        // Customer info
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phone: true,
          },
        },
        // Payment summary — read-only for staff
        payments: {
          select: {
            id: true,
            type: true,
            amount: true,
            method: true,
            mpesaRef: true,
            status: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
        },
        // Status history trail
        statusHistory: {
          select: {
            id: true,
            fromStatus: true,
            toStatus: true,
            changedBy: true,
            note: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
          take: 10,
        },
      },
    }),
    prisma.orders.count({ where }),
    prisma.orders.groupBy({ by: ["status"], _count: { id: true } }),
  ]);

  return NextResponse.json({ orders, total, page, limit, statusCounts });
}
