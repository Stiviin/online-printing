/**
 * app/api/dashboard/route.ts
 * GET /api/dashboard — everything the user dashboard needs in one call
 */
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

export async function GET() {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: session.sub },
    select: { id: true, fullName: true, email: true, phone: true, isVerified: true, isActive: true, role: true, createdAt: true, lastLoginAt: true },
  });
  if (!user?.isActive) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const [orders, payments, paymentStats, orderStats, unreadCount, pendingBalanceAgg] = await Promise.all([
    prisma.orders.findMany({
      where: { userId: session.sub }, orderBy: { createdAt: "desc" }, take: 20,
      select: {
        id: true, serviceId: true, serviceName: true, dimensions: true, quantity: true,
        finishType: true, specialNotes: true, totalPrice: true, depositAmount: true,
        balanceDue: true, artworkUrl: true, artworkFilename: true, mpesaPhone: true,
        status: true, mpesaReceipt: true, createdAt: true, updatedAt: true,
        payments: {
          select: { id: true, type: true, amount: true, mpesaRef: true, status: true, createdAt: true },
          orderBy: { createdAt: "desc" }, take: 5,
        },
      },
    }),
    prisma.payment.findMany({
      where: { order: { userId: session.sub }, status: "COMPLETED" }, orderBy: { createdAt: "desc" }, take: 10,
      select: { id: true, type: true, amount: true, method: true, mpesaRef: true, status: true, createdAt: true, order: { select: { id: true, serviceName: true } } },
    }),
    prisma.payment.aggregate({ where: { order: { userId: session.sub }, status: "COMPLETED" }, _sum: { amount: true }, _count: { id: true } }),
    prisma.orders.groupBy({ by: ["status"], where: { userId: session.sub }, _count: { id: true } }),
    prisma.notification.count({ where: { userId: session.sub, isRead: false } }),
    prisma.orders.aggregate({
      where: { userId: session.sub, status: { in: ["IN_PRODUCTION","QUALITY_CHECK","READY","DELIVERING"] }, balanceDue: { gt: 0 } },
      _sum: { balanceDue: true },
    }),
  ]);

  const ACTIVE = ["PENDING_PAYMENT","IN_PRODUCTION","QUALITY_CHECK","READY","DELIVERING","PAYMENT_ERROR"];
  const stats = {
    totalOrders:      orderStats.reduce((s, g) => s + g._count.id, 0),
    activeOrders:     orderStats.filter(g => ACTIVE.includes(g.status)).reduce((s, g) => s + g._count.id, 0),
    completedOrders:  orderStats.find(g => g.status === "COMPLETED")?._count.id ?? 0,
    totalPaid:        paymentStats._sum.amount ?? 0,
    totalTransactions: paymentStats._count.id  ?? 0,
    pendingBalance:   pendingBalanceAgg._sum.balanceDue ?? 0,
  };

  return NextResponse.json({ user, orders, payments, stats, unreadCount });
}
