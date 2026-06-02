/**
 * lib/getCurrentUser.ts
 *
 * Server-side helper used in Route Handlers that receive a raw Request
 * object (e.g. middleware or edge functions).
 *
 * For App Router Server Components / Route Handlers that can call
 * next/headers directly, prefer getSessionUser() from lib/auth.ts instead —
 * it reads the cookie automatically without needing the Request.
 *
 * This file fixes two bugs in the original:
 *   1. Wrong cookie name ("auth_token" instead of "fs_token")
 *   2. Missing await on verifyToken (it returns a Promise)
 */

import { parse } from "cookie";
import { verifyToken, type SessionPayload } from "@/lib/auth";
import prisma from "@/lib/prisma";
import type { User } from "@prisma/client";

// Return type excludes the password hash — never leak it
type SafeUser = Omit<User, "passwordHash">;

/**
 * Parse the fs_token cookie from a raw Request, verify the JWT,
 * then return the full User row from the database (minus passwordHash).
 *
 * Returns null if:
 *   - Cookie is absent
 *   - JWT is expired or invalid
 *   - User no longer exists or is deactivated
 */
export async function getCurrentUser(req: Request): Promise<SafeUser | null> {
  const cookieHeader = req.headers.get("cookie") ?? "";
  const parsed = parse(cookieHeader);
  const token = parsed["fs_token"]; // must match COOKIE_NAME in lib/auth.ts

  if (!token) return null;

  let payload: SessionPayload | null;
  try {
    payload = await verifyToken(token); // was missing await in original
  } catch {
    return null;
  }

  if (!payload?.sub) return null;

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    // Explicitly omit passwordHash, resetToken, verifyToken
    select: {
      id: true,
      fullName: true,
      email: true,
      phone: true,
      isVerified: true,
      isActive: true,
      role: true,
      createdAt: true,
      updatedAt: true,
      lastLoginAt: true,
      // Excluded: passwordHash, verifyToken, verifyTokenExpiry,
      //           resetToken, resetTokenExpiry
    },
  });

  // Treat deactivated accounts the same as non-existent
  if (!user || !user.isActive) return null;

  return user as SafeUser;
}
