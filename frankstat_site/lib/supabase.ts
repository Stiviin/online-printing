/**
 * lib/supabase.ts
 *
 * Two Supabase clients:
 *  - `supabase`        — anon key, safe to use in browser/client components
 *  - `supabaseAdmin`   — service-role key, server-side only (API routes)
 *
 * All DB queries still go through Prisma (lib/prisma.ts).
 * These clients are used for Supabase Storage (artwork uploads), realtime, etc.
 */

import { createClient } from "@supabase/supabase-js";

const url  = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const svc  = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!url || !anon) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
}

/** Browser-safe client — limited by RLS policies */
export const supabase = createClient(url, anon);

/** Server-only client — bypasses RLS, use only in API routes */
export const supabaseAdmin = createClient(url, svc, {
  auth: { autoRefreshToken: false, persistSession: false },
});
