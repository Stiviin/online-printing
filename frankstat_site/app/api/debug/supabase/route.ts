import { NextResponse } from "next/server";

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? null;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? null;

  const maskedAnon = anon
    ? `${anon.slice(0, 6)}...${anon.slice(-6)}`
    : null;

  return NextResponse.json({
    urlPresent: Boolean(url),
    url: url ? url.replace(/(^\s+|\s+$)/g, "") : null,
    anonPresent: Boolean(anon),
    anonMasked: maskedAnon,
    anonLength: anon ? anon.length : 0,
  });
}
