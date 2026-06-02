/**
 * app/api/auth/logout/route.ts
 *
 * POST /api/auth/logout
 *
 * Clears the session cookie. Because our JWTs are stateless we cannot
 * server-side invalidate them, but:
 *   - The cookie is HttpOnly (JS cannot steal it)
 *   - Sessions are short-lived (24 h)
 *   - Max-Age=0 removes the cookie from the browser immediately
 */

import { NextResponse } from "next/server";
import { clearAuthCookie, getSessionUser } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function POST(req: Request) {
  const session = await getSessionUser().catch(() => null);
  if (session?.sub) {
    prisma.auditLog.create({
      data: {
        userId: session.sub,
        action: "LOGOUT",
        entity: "User",
        entityId: session.sub,
        ipAddress:
          req.headers.get("x-forwarded-for") ??
          req.headers.get("x-real-ip") ??
          null,
      },
    }).catch(() => {});
  }

  const res = NextResponse.json({ ok: true });
  res.headers.append("Set-Cookie", clearAuthCookie());
  return res;
}
