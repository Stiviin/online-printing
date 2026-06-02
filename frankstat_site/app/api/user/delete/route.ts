// app/api/user/delete/route.ts
import { NextResponse } from "next/server";
import { getSessionUser, verifyPassword, clearAuthCookie } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function POST(req: Request) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { password } = await req.json();
  if (!password) return NextResponse.json({ error: "Password is required" }, { status: 400 });

  const user = await prisma.user.findUnique({ where: { id: session.sub } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) return NextResponse.json({ error: "Incorrect password" }, { status: 400 });

  // Cascade-delete related records first (if not using Prisma cascade)
  await prisma.supportTicket.deleteMany({ where: { userId: session.sub } });

  // Nullify userId on orders (keep order history for business records)
  await prisma.orders.updateMany({
    where: { userId: session.sub },
    data:  { userId: null },
  });

  await prisma.user.delete({ where: { id: session.sub } });

  const res = NextResponse.json({ ok: true });
  res.headers.append("Set-Cookie", clearAuthCookie());
  return res;
}
