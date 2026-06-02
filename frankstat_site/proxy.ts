/**
 * proxy.ts (project root, next to app/)
 *
 * Next.js Edge Middleware — runs before every request.
 * Protects /staff/* and /admin/* routes at the edge so unauthenticated users
 * are redirected to /login before the page even renders.
 *
 * Also protects /api/staff/* and /api/admin/* so those endpoints can't be hit
 * without a valid JWT even if the client skips the page redirect.
 *
 * Note: the route handlers still do their own session checks
 * (defence in depth). This middleware is a fast first line of defence.
 */

import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET ?? "change-me-in-production-must-be-at-least-32-chars!!"
);

const STAFF_ROUTES = ["/staff"];
const ADMIN_ROUTES = ["/admin"];
const STAFF_API    = ["/api/staff"];
const ADMIN_API    = ["/api/admin"];

export default async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isStaffPage = STAFF_ROUTES.some(p => pathname.startsWith(p));
  const isAdminPage = ADMIN_ROUTES.some(p => pathname.startsWith(p));
  const isStaffApi  = STAFF_API.some(p => pathname.startsWith(p));
  const isAdminApi  = ADMIN_API.some(p => pathname.startsWith(p));

  if (!isStaffPage && !isAdminPage && !isStaffApi && !isAdminApi) return NextResponse.next();

  // Read the JWT from the HttpOnly cookie
  const token = req.cookies.get("fs_token")?.value;

  if (!token) {
    if (isStaffApi || isAdminApi) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("reason", isAdminPage ? "admin" : "staff");
    return NextResponse.redirect(url);
  }

  try {
    const { payload } = await jwtVerify(token, SECRET, { algorithms: ["HS256"] });
    console.log("[proxy] JWT verified. Payload role:", payload.role);
    const role = payload.role as string | undefined;

    // /admin/* requires ADMIN
    if ((isAdminPage || isAdminApi) && role !== "ADMIN") {
      if (isAdminApi) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      const url = req.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("reason", "admin");
      return NextResponse.redirect(url);
    }

    // /staff/* requires STAFF or ADMIN
    if ((isStaffPage || isStaffApi) && !["STAFF", "ADMIN"].includes(role ?? "")) {
      if (isStaffApi) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      const url = req.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("reason", "staff");
      return NextResponse.redirect(url);
    }

    // Valid token — pass through with role header for route handlers
    const res = NextResponse.next();
    res.headers.set("x-user-role", role ?? "CUSTOMER");
    return res;
  } catch {
    // Expired or invalid token
    if (isStaffApi || isAdminApi) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("reason", "session_expired");
    return NextResponse.redirect(url);
  }
}

export const config = {
  matcher: ["/staff/:path*", "/admin/:path*", "/api/staff/:path*", "/api/admin/:path*"],
};
