/**
 * app/api/cron/cleanup/route.ts
 *
 * GET /api/cron/cleanup
 *
 * Deletes AuditLog records older than 7 days.
 * Protected by CRON_SECRET env var.
 *
 * Vercel cron hits this daily via vercel.json.
 * For non-Vercel, set a system cron: curl -H "Authorization: Bearer $CRON_SECRET" https://yourdomain/api/cron/cleanup
 */

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;

  // Require the secret header to prevent unauthorised triggers
  const auth = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const { count } = await prisma.auditLog.deleteMany({
    where: { createdAt: { lt: cutoff } },
  });

  console.log(`[cron/cleanup] deleted ${count} audit log entries older than ${cutoff.toISOString()}`);

  return NextResponse.json({ ok: true, deleted: count, cutoff });
}
