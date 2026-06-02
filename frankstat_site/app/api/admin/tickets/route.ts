/**
 * GET /api/admin/tickets — all support tickets
 */
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/adminGuard";

export async function GET(req: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const sp     = new URL(req.url).searchParams;
  const page   = Math.max(1, parseInt(sp.get("page")  ?? "1", 10));
  const limit  = Math.min(100, parseInt(sp.get("limit") ?? "30", 10));
  const skip   = (page - 1) * limit;
  const status = sp.get("status")?.trim() || undefined;
  const search = sp.get("search")?.trim() || undefined;

  const where: Prisma.SupportTicketWhereInput = {};
  if (status) where.status = status as any;
  if (search) where.OR = [{ subject: { contains: search } }, { message: { contains: search } }, { user: { email: { contains: search } } }];

  const [tickets, total] = await Promise.all([
    prisma.supportTicket.findMany({
      where, orderBy: { createdAt: "desc" }, skip, take: limit,
      select: { id: true, subject: true, message: true, status: true, response: true, respondedBy: true, respondedAt: true, orderId: true, createdAt: true, updatedAt: true, user: { select: { id: true, fullName: true, email: true } } },
    }),
    prisma.supportTicket.count({ where }),
  ]);

  return NextResponse.json({ tickets, total, page, limit });
}
