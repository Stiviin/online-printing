/**
 * app/api/auth/login/route.ts
 *
 * POST /api/auth/login
 *
 * Authenticates a user with email + password, sets a 24-hour HttpOnly
 * session cookie, and updates lastLoginAt.
 *
 * Security notes:
 *   - Generic error for wrong credentials (never reveal which field is wrong)
 *   - Unverified accounts are rejected with a specific message so the
 *     frontend can offer a "resend verification" link
 *   - Deactivated accounts are treated identically to "not found"
 *   - lastLoginAt is updated and an AuditLog row is written on success
 *   - Session JWT contains sub (userId), email, role — no sensitive data
 */

import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import prisma from "@/lib/prisma";
import {
  verifyPassword,
  signToken,
  createAuthCookie,
} from "@/lib/auth";
import { rateLimit, clientIp } from "@/lib/rateLimit";

// ─────────────────────────────────────────────────────────────────────────────
// Input schema
// ─────────────────────────────────────────────────────────────────────────────

const loginSchema = z.object({
  email: z
    .string()
    .email("Enter a valid email address")
    .transform(s => s.toLowerCase().trim()),

  password: z
    .string()
    .min(1, "Password is required")
    .max(128),
});

// Generic message used whenever credentials are wrong.
// Never tell the caller whether the email or the password was incorrect.
const INVALID_CREDENTIALS = "Incorrect email or password.";

// ─────────────────────────────────────────────────────────────────────────────
// Handler
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  // Rate limit: 10 attempts per 15 minutes per IP
  const rl = rateLimit(`login:${clientIp(req)}`, { limit: 10, windowMs: 15 * 60_000 });
  if (rl.limited) {
    return NextResponse.json(
      { error: "Too many login attempts. Please try again later." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } }
    );
  }

  try {
    // 1. Parse & validate
    const json = await req.json().catch(() => null);
    if (!json || typeof json !== "object") {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }

    const { email, password } = loginSchema.parse(json);

    // 2. Look up user — select only what we need (never fetch unnecessary data)
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        passwordHash: true,
        isVerified: true,
        role: true,          // ← required: baked into the JWT for route-level auth
        isActive: true,      // ← also fetch so deactivated accounts can be rejected
      },
    });

    // 3. User not found or deactivated — run a dummy compare to prevent timing attacks
    //    (an attacker measuring response time could otherwise detect valid emails)
    if (!user || !user.isActive) {
      await verifyPassword(password, "$2b$12$invalidhashpadding000000000000000000000000000000000000");
      return NextResponse.json({ error: INVALID_CREDENTIALS }, { status: 401 });
    }

    // 4. Password check
    const passwordOk = await verifyPassword(password, user.passwordHash);
    if (!passwordOk) {
      // Audit failed attempt (useful for detecting brute-force)
      prisma.auditLog.create({
        data: {
          userId: user.id,
          action: "LOGIN_FAILED",
          entity: "User",
          entityId: user.id,
          ipAddress: req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? null,
        },
      }).catch(() => {}); // non-critical — never let this break the response

      return NextResponse.json({ error: INVALID_CREDENTIALS }, { status: 401 });
    }

    // 5. Email not verified — special message so frontend can offer resend
    if (!user.isVerified) {
      return NextResponse.json(
        {
          error: "Please verify your email address before logging in.",
          code: "EMAIL_NOT_VERIFIED",
        },
        { status: 403 }
      );
    }

    // 6. Issue 24-hour JWT
    const token = await signToken({
      sub: user.id,
      email: user.email,
      role: user.role,
    });

    // 7. Update lastLoginAt + write audit log (fire-and-forget — non-blocking)
    prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      }),
      prisma.auditLog.create({
        data: {
          userId: user.id,
          action: "LOGIN",
          entity: "User",
          entityId: user.id,
          ipAddress: req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? null,
        },
      }),
    ]).catch((err) => {
      console.error("[login] lastLoginAt update failed:", err);
    });

    // 8. Set cookie and return safe user object
    const res = NextResponse.json({
      ok: true,
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        role: user.role,
      },
    });
    res.headers.append("Set-Cookie", createAuthCookie(token));
    return res;
  } catch (err) {
    if (err instanceof ZodError) {
      const message = err.issues?.[0]?.message ?? "Invalid input.";
      return NextResponse.json(
        { error: message },
        { status: 422 }
      );
    }

    console.error("[login] Unexpected error:", err);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
