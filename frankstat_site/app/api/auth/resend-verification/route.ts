/**
 * app/api/auth/resend-verification/route.ts
 *
 * POST /api/auth/resend-verification
 * Body: { email: string }
 *
 * Issues a fresh verification token and resends the email.
 * Always returns 200 even if the email is unknown — prevents
 * email enumeration (an attacker cannot use this endpoint to
 * discover which emails are registered).
 *
 * Rate-limit this endpoint in production (e.g. Upstash Ratelimit)
 * to prevent email flooding.
 */

import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import prisma from "@/lib/prisma";
import {
  generateSecureToken,
  tokenExpiry,
  VERIFY_TOKEN_TTL_MS,
} from "@/lib/auth";
import { sendVerificationEmail } from "@/lib/email";
import { rateLimit, clientIp } from "@/lib/rateLimit";

const schema = z.object({
  email: z.string().email().toLowerCase().trim(),
});

// Generic response — never reveal whether the email exists
const OK_RESPONSE = NextResponse.json({
  ok: true,
  message:
    "If that email is registered and unverified, a new verification link has been sent.",
});

export async function POST(req: Request) {
  // Rate limit: 3 resend attempts per hour per IP
  const rl = rateLimit(`resend-verify:${clientIp(req)}`, { limit: 3, windowMs: 60 * 60_000 });
  if (rl.limited) return OK_RESPONSE; // silently swallow — don't expose the limit

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
        isVerified: true,
        isActive: true,
      },
    });

    // Silently succeed for unknown / verified / deactivated accounts
    if (!user || user.isVerified || !user.isActive) return OK_RESPONSE;

    // Generate a fresh token and update the DB
    const newToken = generateSecureToken();
    await prisma.user.update({
      where: { id: user.id },
      data: {
        verifyToken: newToken,
        verifyTokenExpiry: tokenExpiry(VERIFY_TOKEN_TTL_MS),
      },
    });

    // Send email (non-blocking)
    sendVerificationEmail({
      to: user.email,
      fullName: user.fullName,
      token: newToken,
    }).catch((err) => {
      console.error("[resend-verification] Email failed:", err);
    });

    return OK_RESPONSE;
  } catch (err) {
    if (err instanceof ZodError) return OK_RESPONSE; // don't hint at schema
    console.error("[resend-verification] Error:", err);
    return OK_RESPONSE; // always 200 for this endpoint
  }
}
