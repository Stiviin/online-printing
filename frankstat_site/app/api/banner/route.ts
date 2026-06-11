// GET /api/banner — public, returns active banner config for the homepage ticker
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
  const banner = await prisma.siteBanner.findFirst({ orderBy: { updatedAt: "desc" } });
  if (!banner || !banner.isActive) {
    return NextResponse.json({ isActive: false, items: [] });
  }
  return NextResponse.json({ isActive: true, items: banner.items as string[] });
}
