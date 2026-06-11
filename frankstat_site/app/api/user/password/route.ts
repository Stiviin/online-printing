// app/api/user/password/route.ts
import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { getSessionUser, verifyPassword, hashPassword } from "@/lib/auth";
import prisma from "@/lib/prisma";

const schema = z.object({
  currentPassword: z.string().min(1, "Current password is required").max(128),
  newPassword: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128)
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      "Password must contain at least one uppercase letter, one lowercase letter, and one number"
    ),
});

export async function POST(req: Request) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  try {
    const json = await req.json().catch(() => null);
    if (!json) return NextResponse.json({ error: "Invalid request body." }, { status: 400 });

    const { currentPassword, newPassword } = schema.parse(json);

    if (currentPassword === newPassword)
      return NextResponse.json({ error: "New password must differ from current password." }, { status: 400 });

    const user = await prisma.user.findUnique({ where: { id: session.sub }, select: { passwordHash: true } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const valid = await verifyPassword(currentPassword, user.passwordHash);
    if (!valid) return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });

    const passwordHash = await hashPassword(newPassword);
    await prisma.user.update({ where: { id: session.sub }, data: { passwordHash } });

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof ZodError)
      return NextResponse.json({ error: err.issues[0]?.message ?? "Invalid input." }, { status: 422 });
    console.error("[user/password]", err);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
