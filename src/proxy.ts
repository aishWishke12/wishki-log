import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { TOKEN_COOKIE } from "@/lib/auth-shared";

const PUBLIC_PATHS = new Set([
  "/login",
  "/api/login",
  "/api/logout",
  "/api/refresh",
  "/api/reauth",
]);

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasToken = Boolean(request.cookies.get(TOKEN_COOKIE)?.value);

  if (PUBLIC_PATHS.has(pathname)) {
    // Already signed in? Skip the login screen.
    if (pathname === "/login" && hasToken) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return NextResponse.next();
  }

  if (!hasToken) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.png|logo.png|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico)$).*)",
  ],
};
