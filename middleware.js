// Runs before matching requests (see `config.matcher` below).
// 1. Looks up the session in the database (this also refreshes it when needed).
// 2. Signed out + private page → redirect to /login?next=<page>.
// 3. Signed in + / or /login → redirect to the dashboard.
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { DEFAULT_AFTER_LOGIN } from "@/lib/safe-redirect";

const PROTECTED_PREFIXES = ["/log", "/snap", "/meals", "/dashboard"];

function isProtected(pathname) {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export async function middleware(request) {
  const { pathname, search } = request.nextUrl;

  // returnHeaders gives us any Set-Cookie headers Better Auth wants to send
  // (e.g. a refreshed session cookie), so we can pass them on to the browser.
  const { headers: authHeaders, response: session } = await auth.api.getSession({
    headers: request.headers,
    returnHeaders: true,
  });

  let response;
  if (!session && isProtected(pathname)) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname + search);
    response = NextResponse.redirect(loginUrl);
  } else if (session && (pathname === "/login" || pathname === "/")) {
    // Signed-in users skip the landing and login pages and go straight to their dashboard.
    response = NextResponse.redirect(new URL(DEFAULT_AFTER_LOGIN, request.url));
  } else {
    response = NextResponse.next();
  }

  const setCookies = authHeaders?.getSetCookie?.() ?? [];
  for (const cookie of setCookies) response.headers.append("set-cookie", cookie);

  return response;
}

export const config = {
  // Node.js runtime (stable in Next.js 15.5) so middleware can query Postgres.
  // The default "edge" runtime can't use the pg driver.
  runtime: "nodejs",
  // Only run on pages that care about auth; skips static files and /api/auth.
  matcher: ["/", "/login", "/log/:path*", "/snap/:path*", "/meals/:path*", "/dashboard/:path*"],
};
