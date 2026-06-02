/**
 * app/api/payments/route.ts
 * GET /api/payments — authenticated user's payment history + stats
 */
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

export async function GET(req: Request) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const page  = Math.max(1, parseInt(searchParams.get("page")  ?? "1",  10));
  const limit = Math.min(100, parseInt(searchParams.get("limit") ?? "50", 10));
  const skip  = (page - 1) * limit;

  const [payments, total, stats] = await Promise.all([
    prisma.payment.findMany({
      where: { order: { userId: session.sub } },
      orderBy: { createdAt: "desc" },
      skip, take: limit,
      select: {
        id: true, type: true, amount: true, method: true,
        mpesaRef: true, mpesaPhone: true, status: true,
        failReason: true, createdAt: true, updatedAt: true,
        order: {
          select: { id: true, serviceName: true, totalPrice: true, depositAmount: true, balanceDue: true, status: true },
        },
      },
    }),
    prisma.payment.count({ where: { order: { userId: session.sub } } }),
    prisma.payment.aggregate({
      where: { order: { userId: session.sub }, status: "COMPLETED" },
      _sum: { amount: true }, _count: { id: true },
    }),
  ]);

  return NextResponse.json({
    payments, total, page, limit,
    stats: { totalPaid: stats._sum.amount ?? 0, totalTransactions: stats._count.id ?? 0 },
  });
}
