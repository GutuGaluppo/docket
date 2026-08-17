import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIES = ["authjs.session-token", "__Secure-authjs.session-token"];

/**
 * Cookie presence only — the session is validated against the database in the
 * (app) layout. This exists so a signed-out visitor is bounced before the app
 * shell renders, not as the authorisation check.
 */
export function middleware(request: NextRequest) {
  const hasSession = SESSION_COOKIES.some((name) => request.cookies.has(name));
  if (hasSession) return NextResponse.next();

  const signIn = new URL("/sign-in", request.url);
  signIn.searchParams.set("callbackUrl", request.nextUrl.pathname + request.nextUrl.search);
  return NextResponse.redirect(signIn);
}

export const config = {
  matcher: ["/docket/:path*", "/board/:path*", "/calendar/:path*", "/settings/:path*"],
};
