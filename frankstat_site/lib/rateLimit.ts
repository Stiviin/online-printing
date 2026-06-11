/**
 * lib/rateLimit.ts
 *
 * In-memory sliding-window rate limiter.
 * Safe for single-process (self-hosted) Next.js deployments.
 *
 * Usage:
 *   const rl = rateLimit(`login:${ip}`, { limit: 10, windowMs: 15 * 60_000 });
 *   if (rl.limited) return NextResponse.json({ error: "Too many requests." }, { status: 429 });
 */

interface Window {
  count: number;
  resetAt: number;
}

const store = new Map<string, Window>();

export interface RateLimitResult {
  limited: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export function rateLimit(
  key: string,
  opts: { limit: number; windowMs: number }
): RateLimitResult {
  const now = Date.now();
  let entry = store.get(key);

  if (!entry || entry.resetAt <= now) {
    entry = { count: 0, resetAt: now + opts.windowMs };
    store.set(key, entry);
  }

  entry.count += 1;
  const limited = entry.count > opts.limit;

  return {
    limited,
    remaining: Math.max(0, opts.limit - entry.count),
    retryAfterSeconds: Math.ceil((entry.resetAt - now) / 1000),
  };
}

/** Extract the most-specific client IP from request headers */
export function clientIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}

// Purge expired entries every 5 minutes to prevent unbounded memory growth
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (entry.resetAt <= now) store.delete(key);
  }
}, 5 * 60_000);
