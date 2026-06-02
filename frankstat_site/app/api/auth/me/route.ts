/**
 * app/api/auth/me/route.ts
 *
 * GET /api/auth/me
 *
 * Returns the authenticated user's profile. Called on every page load
 * by the frontend to populate the nav and personalise the UI.
 *
 * Returns 401 if not authenticated or if the user no longer exists /
 * has been deactivated.
 */

import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET() {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ user: null }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.sub },
    select: {
      id: true,
      fullName: true,
      email: true,
      phone: true,
      isVerified: true,
      isActive: true,
      role: true,
      createdAt: true,
      lastLoginAt: true,
    },
  });

  if (!user || !user.isActive) {
    // User deleted or deactivated after the token was issued
    return NextResponse.json({ user: null }, { status: 401 });
  }

  return NextResponse.json({ user });
}
