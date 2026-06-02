/**
 * lib/adminGuard.ts
 * Shared helper used by every /api/admin/* route.
 * Returns the session or throws a NextResponse error.
 */
import { NextResponse } from "next/server";
import { getSessionUser, type SessionPayload } from "@/lib/auth";
import prisma from "@/lib/prisma";

export type AdminSession = SessionPayload & { dbId: string };
export type StaffSession = SessionPayload & { dbId: string };

export async function requireAdmin(): Promise<
  { ok: true; session: AdminSession } |
  { ok: false; response: NextResponse }
> {
  const session = await getSessionUser();
  if (!session) return { ok: false, response: NextResponse.json({ error: "Unauthorised" }, { status: 401 }) };

  // Always read role from DB — never trust the JWT role alone (stale tokens).
  const user = await prisma.user.findUnique({
    where:  { id: session.sub },
    select: { role: true, isActive: true },
  });
  if (!user?.isActive) return { ok: false, response: NextResponse.json({ error: "Unauthorised" }, { status: 401 }) };
  if (user.role !== "ADMIN") return { ok: false, response: NextResponse.json({ error: "Forbidden. Admin access required." }, { status: 403 }) };

  return { ok: true, session: { ...session, dbId: session.sub } };
}

export async function requireStaff(): Promise<
  { ok: true; session: StaffSession } |
  { ok: false; response: NextResponse }
> {
  const session = await getSessionUser();
  if (!session) return { ok: false, response: NextResponse.json({ error: "Unauthorised" }, { status: 401 }) };

  const user = await prisma.user.findUnique({
    where:  { id: session.sub },
    select: { role: true, isActive: true },
  });
  if (!user?.isActive) return { ok: false, response: NextResponse.json({ error: "Unauthorised" }, { status: 401 }) };
  if (!["STAFF", "ADMIN"].includes(user.role))
    return { ok: false, response: NextResponse.json({ error: "Forbidden. Staff access required." }, { status: 403 }) };

  return { ok: true, session: { ...session, dbId: session.sub } };
}

/** Write an audit log entry — never throws, always fire-and-forget safe */
export async function audit(opts: {
  adminId: string; action: string; entity?: string;
  entityId?: string; metadata?: object; req?: Request;
}) {
  prisma.auditLog.create({
    data: {
      userId:   opts.adminId,
      action:   opts.action,
      entity:   opts.entity   ?? null,
      entityId: opts.entityId ?? null,
      metadata: opts.metadata ?? undefined,
      ipAddress: opts.req
        ? (opts.req.headers.get("x-forwarded-for") ?? opts.req.headers.get("x-real-ip") ?? null)
        : null,
    },
  }).catch(e => console.error("[audit] write failed:", e));
}
