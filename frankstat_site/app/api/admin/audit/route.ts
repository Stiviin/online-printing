/**
 * GET /api/admin/audit — paginated audit log with filters
 * Query: page, limit, action, userId, entity, from, to, search
 */
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/adminGuard";

export async function GET(req: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const sp     = new URL(req.url).searchParams;
  const page   = Math.max(1, parseInt(sp.get("page")  ?? "1",   10));
  const limit  = Math.min(200, parseInt(sp.get("limit") ?? "50",  10));
  const skip   = (page - 1) * limit;
  const action = sp.get("action")?.trim() || undefined;
  const userId = sp.get("userId")?.trim() || undefined;
  const entity = sp.get("entity")?.trim() || undefined;
  const from   = sp.get("from") || undefined;
  const to     = sp.get("to")   || undefined;
  const search = sp.get("search")?.trim() || undefined;

  const where: Prisma.AuditLogWhereInput = {};
  if (action) where.action   = { contains: action };
  if (userId) where.userId   = userId;
  if (entity) where.entity   = entity;
  if (from || to) where.createdAt = { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) };
  if (search) where.OR = [
    { action:   { contains: search } },
    { entityId: { contains: search } },
    { user: { fullName: { contains: search } } },
    { user: { email:    { contains: search } } },
  ];

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where, orderBy: { createdAt: "desc" }, skip, take: limit,
      select: { id: true, action: true, entity: true, entityId: true, metadata: true, ipAddress: true, createdAt: true, user: { select: { id: true, fullName: true, email: true, role: true } } },
    }),
    prisma.auditLog.count({ where }),
  ]);

  return NextResponse.json({ logs, total, page, limit });
}
