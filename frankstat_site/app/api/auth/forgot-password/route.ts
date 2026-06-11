/**
 * app/api/auth/forgot-password/route.ts
 *
 * POST /api/auth/forgot-password
 * Body: { email: string }
 *
 * Generates a 1-hour password reset token and emails the link.
 * Always returns 200 regardless of whether the email is registered
 * (prevents email enumeration).
 */

import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import prisma from "@/lib/prisma";
import {
  generateSecureToken,
  tokenExpiry,
  RESET_TOKEN_TTL_MS,
} from "@/lib/auth";
import { sendPasswordResetEmail } from "@/lib/email";
import { rateLimit, clientIp } from "@/lib/rateLimit";

const schema = z.object({
  email: z.string().email().toLowerCase().trim(),
});

const OK_RESPONSE = NextResponse.json({
  ok: true,
  message:
    "If that email is registered, a password reset link has been sent.",
});

export async function POST(req: Request) {
  // Rate limit: 3 requests per hour per IP (email flooding protection)
  const rl = rateLimit(`forgot-pw:${clientIp(req)}`, { limit: 3, windowMs: 60 * 60_000 });
  if (rl.limited) return OK_RESPONSE; // silently swallow — don't confirm the limit exists

  try {
    const json = await req.json().catch(() => null);
    if (!json) return OK_RESPONSE;

    const { email } = schema.parse(json);

    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        fullName: true,
        email: true,
        isActive: true,
      },
    });

    if (!user || !user.isActive) {
      console.log(`[forgot-password] No active user found for: ${email}`);
      return OK_RESPONSE;
    }

    // Generate reset token
    const resetToken = generateSecureToken();
    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetToken,
        resetTokenExpiry: tokenExpiry(RESET_TOKEN_TTL_MS),
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "PASSWORD_RESET_REQUESTED",
        entity: "User",
        entityId: user.id,
        ipAddress:
          req.headers.get("x-forwarded-for") ??
          req.headers.get("x-real-ip") ??
          null,
      },
    }).catch(() => {});

    // Send email (non-blocking)
    console.log(`[forgot-password] Sending reset email to ${user.email}...`);
    sendPasswordResetEmail({
      to: user.email,
      fullName: user.fullName,
      token: resetToken,
    }).then(() => {
      console.log(`[forgot-password] Email sent successfully to ${user.email}`);
    }).catch((err) => {
      console.error("[forgot-password] Email failed:", err);
    });

    return OK_RESPONSE;
  } catch (err) {
    if (err instanceof ZodError) return OK_RESPONSE;
    console.error("[forgot-password] Error:", err);
    return OK_RESPONSE;
  }
}
