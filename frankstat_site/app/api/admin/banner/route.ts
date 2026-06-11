// GET  /api/admin/banner — fetch current banner config
// PATCH /api/admin/banner — update banner config (admin only)
import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/adminGuard";

const patchSchema = z.object({
  isActive: z.boolean(),
  items: z
    .array(z.string().min(1).max(200).trim())
    .min(0)
    .max(10),
});

export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const banner = await prisma.siteBanner.findFirst({ orderBy: { updatedAt: "desc" } });
  return NextResponse.json({
    isActive: banner?.isActive ?? false,
    items: (banner?.items as string[]) ?? [],
  });
}

export async function PATCH(req: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  try {
    const json = await req.json().catch(() => null);
    if (!json) return NextResponse.json({ error: "Invalid request body." }, { status: 400 });

    const { isActive, items } = patchSchema.parse(json);

    const existing = await prisma.siteBanner.findFirst({ orderBy: { updatedAt: "desc" } });

    const banner = existing
      ? await prisma.siteBanner.update({
          where: { id: existing.id },
          data: { isActive, items, updatedBy: guard.session.sub },
        })
      : await prisma.siteBanner.create({
          data: { isActive, items, updatedBy: guard.session.sub },
        });

    return NextResponse.json({ ok: true, isActive: banner.isActive, items: banner.items as string[] });
  } catch (err) {
    if (err instanceof ZodError)
      return NextResponse.json({ error: err.issues[0]?.message ?? "Invalid input." }, { status: 422 });
    console.error("[admin/banner PATCH]", err);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
