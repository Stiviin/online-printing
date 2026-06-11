/**
 * lib/auth.ts
 *
 * Central auth module. Covers:
 *   - Password hashing & comparison (bcrypt, cost 12)
 *   - JWT signing & verification (HS256, 24-hour expiry)
 *   - HttpOnly cookie creation & clearing
 *   - Server-side session reading (Next.js App Router)
 *   - Secure token generation for email verify & password reset
 *
 * All durations are explicit constants at the top — change them in one place.
 */

import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { randomBytes } from "crypto";

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS  (change here, nowhere else)
// ─────────────────────────────────────────────────────────────────────────────

const COOKIE_NAME = "fs_token";

/** JWT lifetime – 24 hours */
export const SESSION_DURATION_SECONDS = 60 * 60 * 24;

/** Email verification token lifetime – 24 hours */
export const VERIFY_TOKEN_TTL_MS = 1000 * 60 * 60 * 24;

/** Password reset token lifetime – 1 hour */
export const RESET_TOKEN_TTL_MS = 1000 * 60 * 60;

const _jwtSecretValue = process.env.JWT_SECRET;
if (!_jwtSecretValue) throw new Error("JWT_SECRET environment variable is not set. Add it to .env");
const JWT_SECRET = new TextEncoder().encode(_jwtSecretValue);

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface SessionPayload extends JWTPayload {
  sub: string;
  email: string;
  role: string;
  iat: number;
  exp: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// PASSWORD HELPERS
// ─────────────────────────────────────────────────────────────────────────────

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12);
}

export async function verifyPassword(
  plain: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

// ─────────────────────────────────────────────────────────────────────────────
// JWT HELPERS
// ─────────────────────────────────────────────────────────────────────────────

export async function signToken(payload: {
  sub: string;
  email: string;
  role: string;
}): Promise<string> {
  return new SignJWT({ email: payload.email, role: payload.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_SECONDS}s`)
    .sign(JWT_SECRET);
}

export async function verifyToken(
  token: string
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET, {
      algorithms: ["HS256"],
    });
    return payload as SessionPayload;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// COOKIE HELPERS
// ─────────────────────────────────────────────────────────────────────────────

export function createAuthCookie(token: string): string {
  const isProd = process.env.NODE_ENV === "production";
  const parts = [
    `${COOKIE_NAME}=${token}`,
    `Max-Age=${SESSION_DURATION_SECONDS}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
  ];
  if (isProd) parts.push("Secure");
  return parts.join("; ");
}

export function clearAuthCookie(): string {
  const isProd = process.env.NODE_ENV === "production";
  const parts = [
    `${COOKIE_NAME}=`,
    "Max-Age=0",
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
  ];
  if (isProd) parts.push("Secure");
  return parts.join("; ");
}

// ─────────────────────────────────────────────────────────────────────────────
// SESSION READER  (Next.js App Router)
// ─────────────────────────────────────────────────────────────────────────────

export async function getSessionUser(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyToken(token);
}

export async function requireSession(): Promise<SessionPayload> {
  const session = await getSessionUser();
  if (!session) throw new AuthError("Not authenticated", 401);
  return session;
}

export async function requireRole(
  allowedRoles: string[]
): Promise<SessionPayload> {
  const session = await requireSession();
  if (!allowedRoles.includes(session.role)) {
    throw new AuthError("Insufficient permissions", 403);
  }
  return session;
}

// ─────────────────────────────────────────────────────────────────────────────
// SECURE TOKEN GENERATION
// ─────────────────────────────────────────────────────────────────────────────

/** 32 bytes = 256 bits of entropy, hex-encoded = 64-char URL-safe string */
export function generateSecureToken(): string {
  return randomBytes(32).toString("hex");
}

export function tokenExpiry(ttlMs: number): Date {
  return new Date(Date.now() + ttlMs);
}

// ─────────────────────────────────────────────────────────────────────────────
// CUSTOM ERROR
// ─────────────────────────────────────────────────────────────────────────────

export class AuthError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number = 401
  ) {
    super(message);
    this.name = "AuthError";
  }
}
