import { NextResponse, type NextRequest } from "next/server";

import { CV_ANALYSIS_ENABLED } from "@/lib/features";

const SESSION_COOKIES = ["authjs.session-token", "__Secure-authjs.session-token"];

/**
 * Cookie presence only — the session is validated against the database in the
 * (app) layout. This exists so a signed-out visitor is bounced before the app
 * shell renders, not as the authorisation check.
 */
export function middleware(request: NextRequest) {
  if (!CV_ANALYSIS_ENABLED && request.nextUrl.pathname.startsWith("/cv")) {
    return new NextResponse(null, { status: 404 });
  }

  const hasSession = SESSION_COOKIES.some((name) => request.cookies.has(name));
  if (hasSession) return NextResponse.next();

  const signIn = new URL("/sign-in", request.url);
  signIn.searchParams.set("callbackUrl", request.nextUrl.pathname + request.nextUrl.search);
  return NextResponse.redirect(signIn);
}

export const config = {
  matcher: [
    "/docket/:path*",
    "/applications/:path*",
    "/board/:path*",
    "/calendar/:path*",
    "/archive/:path*",
    "/cv/:path*",
    "/analytics/:path*",
    "/settings/:path*",
  ],
};
