/**
 * GET    /api/admin/users/:id  — full user profile
 * PATCH  /api/admin/users/:id  — update name, email, phone, role, isActive, password
 * DELETE /api/admin/users/:id  — soft-delete (isActive=false); hard-delete blocked
 */
import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { requireAdmin, audit } from "@/lib/adminGuard";
import { hashPassword } from "@/lib/auth";

type Ctx = { params: Promise<{ id: string }> };

// ── GET ───────────────────────────────────────────────────────────────────────
export async function GET(_req: Request, { params }: Ctx) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true, fullName: true, email: true, phone: true,
      role: true, isActive: true, isVerified: true,
      createdAt: true, updatedAt: true, lastLoginAt: true,
      orders: {
        orderBy: { createdAt: "desc" }, take: 10,
        select: { id: true, serviceName: true, totalPrice: true, status: true, createdAt: true },
      },
      _count: { select: { orders: true, tickets: true } },
    },
  });
  if (!user) return NextResponse.json({ error: "User not found." }, { status: 404 });
  return NextResponse.json({ user });
}

// ── PATCH ─────────────────────────────────────────────────────────────────────
const patchSchema = z.object({
  fullName:   z.string().min(2).max(100).trim().optional(),
  email:      z.string().email().transform(s => s.toLowerCase().trim()).optional(),
  phone:      z.string()
    .regex(/^(?:254|\+254|0)?(7|1)(?:(?:[0-9][0-9])|(?:0[0-8]))[0-9]{6}$/, "Invalid Kenyan phone number")
    .nullable()
    .optional(),
  role:       z.enum(["CUSTOMER","STAFF","ADMIN"]).optional(),
  isActive:   z.boolean().optional(),
  isVerified: z.boolean().optional(),
  password:   z.string().min(8).max(128).regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, "Password must have uppercase, lowercase, and number").optional(),
}).strict();

export async function PATCH(req: Request, { params }: Ctx) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const { id } = await params;

  // Read body once — stream cannot be consumed twice
  const body = await req.json().catch(() => ({}));

  // Guard: admin cannot demote/deactivate themselves
  if (id === guard.session.sub) {
    if (["CUSTOMER", "STAFF"].includes(body.role) || body.isActive === false) {
      return NextResponse.json({ error: "You cannot demote or deactivate your own account." }, { status: 422 });
    }
  }

  try {
    const data = patchSchema.parse(body);

    const updateData: Record<string, unknown> = {};
    if (data.fullName   !== undefined) updateData.fullName   = data.fullName;
    if (data.email      !== undefined) updateData.email      = data.email;
    if (data.phone      !== undefined) updateData.phone      = data.phone ?? null;
    if (data.role       !== undefined) updateData.role       = data.role;
    if (data.isActive   !== undefined) updateData.isActive   = data.isActive;
    if (data.isVerified !== undefined) updateData.isVerified = data.isVerified;
    if (data.password) updateData.passwordHash = await hashPassword(data.password);

    if (Object.keys(updateData).length === 0)
      return NextResponse.json({ error: "No valid fields to update." }, { status: 400 });

    // Check email uniqueness if changing
    if (data.email) {
      const clash = await prisma.user.findFirst({ where: { email: data.email, NOT: { id } }, select: { id: true } });
      if (clash) return NextResponse.json({ error: "Email already in use." }, { status: 409 });
    }

    const updated = await prisma.user.update({
      where: { id },
      data: updateData as any,
      select: { id: true, fullName: true, email: true, phone: true, role: true, isActive: true, isVerified: true },
    });

    await audit({ adminId: guard.session.sub, action: "USER_UPDATED", entity: "User", entityId: id, metadata: { changes: Object.keys(updateData) }, req });

    return NextResponse.json({ ok: true, user: updated });
  } catch (err) {
    if (err instanceof ZodError) return NextResponse.json({ error: err.issues[0]?.message }, { status: 422 });
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json({ error: "Email already in use." }, { status: 409 });
    }
    console.error("[admin/users PATCH]", err);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}

// ── DELETE (hard) ─────────────────────────────────────────────────────────────
export async function DELETE(req: Request, { params }: Ctx) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const { id } = await params;

  if (id === guard.session.sub)
    return NextResponse.json({ error: "You cannot delete your own account." }, { status: 422 });

  const user = await prisma.user.findUnique({ where: { id }, select: { id: true, email: true, role: true } });
  if (!user) return NextResponse.json({ error: "User not found." }, { status: 404 });

  await prisma.user.delete({ where: { id } });
  await audit({ adminId: guard.session.sub, action: "USER_DELETED", entity: "User", entityId: id, metadata: { email: user.email }, req });

  return NextResponse.json({ ok: true });
}
