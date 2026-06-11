/**
 * app/api/auth/register/route.ts
 *
 * POST /api/auth/register
 *
 * Creates a new user account and sends a verification email.
 * Does NOT issue a session cookie — the user must verify their email
 * and then log in. This prevents unverified addresses from placing orders.
 *
 * Security notes:
 *   - Zod validates and sanitises all input before it touches Prisma
 *   - Duplicate email/phone are caught with a specific 409 so the
 *     frontend can show a targeted message
 *   - Email-send failure never fails the registration (logged only)
 *   - Verification token is a 256-bit random hex string (not base64 userId)
 *   - Token expiry is stored in the DB and checked at verify time
 *   - An AuditLog row is written for every successful registration
 */

import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import prisma from "@/lib/prisma";
import {
  hashPassword,
  generateSecureToken,
  tokenExpiry,
  VERIFY_TOKEN_TTL_MS,
} from "@/lib/auth";
import { sendVerificationEmail } from "@/lib/email";
import { rateLimit, clientIp } from "@/lib/rateLimit";

// ─────────────────────────────────────────────────────────────────────────────
// Input schema
// ─────────────────────────────────────────────────────────────────────────────

const registerSchema = z.object({
  fullName: z
    .string()
    .min(2, "Full name must be at least 2 characters")
    .max(100)
    .trim(),

  email: z
    .string()
    .email("Enter a valid email address")
    .toLowerCase()
    .trim(),

  phone: z
    .string()
    .regex(
      /^(?:254|\+254|0)?(7|1)(?:(?:[0-9][0-9])|(?:0[0-8]))[0-9]{6}$/,
      "Enter a valid Kenyan phone number (e.g. 0712 345 678)"
    )
    .optional()
    .transform((v) => {
      if (!v) return undefined;
      // Normalise to 2547xxxxxxxx
      const digits = v.replace(/\D/g, "");
      if (digits.startsWith("254")) return digits;
      if (digits.startsWith("0")) return `254${digits.slice(1)}`;
      return `254${digits}`;
    }),

  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128)
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      "Password must contain at least one uppercase letter, one lowercase letter, and one number"
    ),
});

// ─────────────────────────────────────────────────────────────────────────────
// Handler
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  // Rate limit: 5 registrations per hour per IP
  const rl = rateLimit(`register:${clientIp(req)}`, { limit: 5, windowMs: 60 * 60_000 });
  if (rl.limited) {
    return NextResponse.json(
      { error: "Too many sign-up attempts. Please try again later." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } }
    );
  }

  try {
    // 1. Parse & validate body
    const json = await req.json().catch(() => null);
    if (!json || typeof json !== "object") {
      return NextResponse.json(
        { error: "Invalid request body." },
        { status: 400 }
      );
    }

    const data = registerSchema.parse(json);

    // 2. Check for existing email (case-insensitive — already lowercased by Zod)
    const existingEmail = await prisma.user.findUnique({
      where: { email: data.email },
      select: { id: true },
    });
    if (existingEmail) {
      return NextResponse.json(
        { error: "An account with this email already exists." },
        { status: 409 }
      );
    }

    // 3. Check for existing phone (if provided)
    if (data.phone) {
      const existingPhone = await prisma.user.findUnique({
        where: { phone: data.phone },
        select: { id: true },
      });
      if (existingPhone) {
        return NextResponse.json(
          { error: "An account with this phone number already exists." },
          { status: 409 }
        );
      }
    }

    // 4. Hash password & generate verify token
    const [passwordHash, verifyToken] = await Promise.all([
      hashPassword(data.password),
      generateSecureToken(),
    ]);

    // 5. Create user
    const user = await prisma.user.create({
      data: {
        fullName: data.fullName,
        email: data.email,
        phone: data.phone ?? null,
        passwordHash,
        isVerified: false,
        verifyToken,
        verifyTokenExpiry: tokenExpiry(VERIFY_TOKEN_TTL_MS),
        role: "CUSTOMER",
        isActive: true,
      },
      select: {
        id: true,
        fullName: true,
        email: true,
      },
    });

    // 6. Execute background tasks
    // We use Promise.allSettled to ensure they run but don't block the main response
    // or crash the request if one fails.
    await Promise.allSettled([
      prisma.auditLog.create({
        data: {
          userId: user.id,
          action: "REGISTER",
          entity: "User",
          entityId: user.id,
          metadata: { email: user.email },
          ipAddress: req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? null,
        },
      }),
      sendVerificationEmail({
        to: user.email,
        fullName: user.fullName,
        token: verifyToken,
      })
    ]).then((results) => {
      results.forEach((res, idx) => {
        if (res.status === 'rejected') {
          console.error(`[register] Background task ${idx} failed:`, res.reason);
        }
      });
    });

    // 7. Respond — do not issue a session yet
    return NextResponse.json(
      {
        ok: true,
        message:
          "Account created. Please check your email and click the verification link to activate your account.",
      },
      { status: 201 }
    );
  } catch (err) {
    if (err instanceof ZodError) {
      // Return the first validation error in a consistent shape
      const message = err.issues?.[0]?.message ?? "Invalid input.";
      return NextResponse.json(
        { error: message },
        { status: 422 }
      );
    }

    console.error("[register] Unexpected error:", err);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
