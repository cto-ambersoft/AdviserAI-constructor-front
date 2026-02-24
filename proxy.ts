import { NextResponse, type NextRequest } from "next/server";
import { AUTH_REFRESH_COOKIE } from "@/lib/auth/constants";

const AUTH_ROUTES = ["/login", "/signup"];
const PUBLIC_FILE = /\.(.*)$/;

function isAuthRoute(pathname: string) {
  return AUTH_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

function isPublicPath(pathname: string) {
  return (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/favicon.ico") ||
    PUBLIC_FILE.test(pathname)
  );
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const hasToken = Boolean(request.cookies.get(AUTH_REFRESH_COOKIE)?.value);
  const authRoute = isAuthRoute(pathname);

  if (!hasToken && !authRoute) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (hasToken && authRoute) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
