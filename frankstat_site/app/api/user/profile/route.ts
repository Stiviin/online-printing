// app/api/user/profile/route.ts
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import prisma from "@/lib/prisma";

// PATCH /api/user/profile — update name and phone
export async function PATCH(req: Request) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const body = await req.json();
  const fullName = (body.fullName ?? "").trim();
  const phone    = (body.phone ?? "").trim() || null;

  if (!fullName) return NextResponse.json({ error: "Full name is required" }, { status: 400 });

  const user = await prisma.user.update({
    where: { id: session.sub },
    data:  { fullName, phone },
    select: { id: true, fullName: true, email: true, phone: true, isVerified: true, createdAt: true },
  });

  return NextResponse.json({ user });
}
