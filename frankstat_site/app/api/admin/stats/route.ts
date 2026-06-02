/**
 * GET /api/admin/stats
 * Dashboard overview numbers — single parallel fetch.
 */
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/adminGuard";

export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const [
    totalUsers, totalOrders, ordersByStatus,
    revenueAgg, pendingBalanceAgg,
    recentPayments, openTickets, recentAudit,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.orders.count(),
    prisma.orders.groupBy({ by: ["status"], _count: { id: true } }),
    prisma.payment.aggregate({ where: { status: "COMPLETED" }, _sum: { amount: true }, _count: { id: true } }),
    prisma.orders.aggregate({ where: { balanceDue: { gt: 0 }, status: { in: ["IN_PRODUCTION","QUALITY_CHECK","READY","DELIVERING"] } }, _sum: { balanceDue: true } }),
    prisma.payment.findMany({ orderBy: { createdAt: "desc" }, take: 5, select: { id: true, amount: true, type: true, status: true, createdAt: true, order: { select: { serviceName: true, user: { select: { fullName: true } } } } } }),
    prisma.supportTicket.count({ where: { status: { in: ["OPEN","IN_PROGRESS"] } } }),
    prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 8, select: { id: true, action: true, entity: true, entityId: true, createdAt: true, user: { select: { fullName: true, email: true } } } }),
  ]);

  const statusMap: Record<string, number> = {};
  for (const g of ordersByStatus) statusMap[g.status] = g._count.id;

  return NextResponse.json({
    users:  { total: totalUsers },
    orders: {
      total: totalOrders,
      byStatus: statusMap,
      active: (statusMap["IN_PRODUCTION"] ?? 0) + (statusMap["QUALITY_CHECK"] ?? 0) + (statusMap["READY"] ?? 0) + (statusMap["DELIVERING"] ?? 0),
    },
    revenue: {
      totalCollected:    revenueAgg._sum.amount  ?? 0,
      totalTransactions: revenueAgg._count.id    ?? 0,
      pendingBalance:    pendingBalanceAgg._sum.balanceDue ?? 0,
    },
    recentPayments,
    openTickets,
    recentAudit,
  });
}
