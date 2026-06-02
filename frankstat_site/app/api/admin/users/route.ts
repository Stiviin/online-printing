/**
 * GET  /api/admin/users  — paginated user list with search & role filter
 * POST /api/admin/users  — create new staff or admin account
 */
import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { requireAdmin, audit } from "@/lib/adminGuard";
import { hashPassword } from "@/lib/auth";

// ── GET ───────────────────────────────────────────────────────────────────────
export async function GET(req: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const sp     = new URL(req.url).searchParams;
  const page   = Math.max(1, parseInt(sp.get("page")  ?? "1",   10));
  const limit  = Math.min(100, parseInt(sp.get("limit") ?? "30",  10));
  const skip   = (page - 1) * limit;
  const role   = sp.get("role")   ?? undefined;
  const search = sp.get("search")?.trim() ?? undefined;

  const where: Prisma.UserWhereInput = {};
  if (role) where.role = role as any;
  if (search) {
    where.OR = [
      { fullName: { contains: search } },
      { email:    { contains: search } },
      { phone:    { contains: search } },
    ];
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where, orderBy: { createdAt: "desc" }, skip, take: limit,
      select: {
        id: true, fullName: true, email: true, phone: true,
        role: true, isActive: true, isVerified: true,
        createdAt: true, updatedAt: true, lastLoginAt: true,
        _count: { select: { orders: true } },
      },
    }),
    prisma.user.count({ where }),
  ]);

  return NextResponse.json({ users, total, page, limit });
}

// ── POST — create staff/admin ─────────────────────────────────────────────────
const createSchema = z.object({
  fullName: z.string().min(2).max(100).trim(),
  email:    z.string().email().toLowerCase().trim(),
  phone:    z.string().regex(/^(\+?254|0)[17]\d{8}$/, "Invalid Kenyan phone number").optional().nullable(),
  password: z.string().min(8).max(128).regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, "Password needs uppercase, lowercase, and number"),
  role:     z.enum(["STAFF", "ADMIN"]),
});

export async function POST(req: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  try {
    const body = await req.json();
    const data = createSchema.parse(body);

    const existing = await prisma.user.findUnique({ where: { email: data.email }, select: { id: true } });
    if (existing) return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });

    // Normalise phone
    let phone: string | null = null;
    if (data.phone) {
      const d = data.phone.replace(/\D/g, "");
      phone = d.startsWith("254") ? d : `254${d.startsWith("0") ? d.slice(1) : d}`;
    }

    const passwordHash = await hashPassword(data.password);
    const user = await prisma.user.create({
      data: { fullName: data.fullName, email: data.email, phone, passwordHash, role: data.role, isVerified: true, isActive: true },
      select: { id: true, fullName: true, email: true, phone: true, role: true, createdAt: true },
    });

    await audit({ adminId: guard.session.sub, action: "STAFF_CREATED", entity: "User", entityId: user.id, metadata: { email: user.email, role: user.role }, req });

    return NextResponse.json({ ok: true, user }, { status: 201 });
  } catch (err) {
    if (err instanceof ZodError) return NextResponse.json({ error: err.errors[0]?.message }, { status: 422 });
    console.error("[admin/users POST]", err);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
