import { NextResponse } from "next/server";
import { AUTH_ACCESS_COOKIE, AUTH_REFRESH_COOKIE } from "@/lib/auth/constants";
import type { AuthTokenBundle } from "@/lib/auth/token-contract";

const IS_PRODUCTION = process.env.NODE_ENV === "production";

export function setSessionCookies(response: NextResponse, tokens: AuthTokenBundle) {
  response.cookies.set({
    name: AUTH_ACCESS_COOKIE,
    value: tokens.access_token,
    httpOnly: true,
    secure: IS_PRODUCTION,
    sameSite: "lax",
    path: "/",
    maxAge: Math.max(0, Math.floor(tokens.expires_in)),
  });

  response.cookies.set({
    name: AUTH_REFRESH_COOKIE,
    value: tokens.refresh_token,
    httpOnly: true,
    secure: IS_PRODUCTION,
    sameSite: "lax",
    path: "/",
    maxAge: Math.max(0, Math.floor(tokens.refresh_expires_in)),
  });
}

export function clearSessionCookies(response: NextResponse) {
  response.cookies.set({
    name: AUTH_ACCESS_COOKIE,
    value: "",
    httpOnly: true,
    secure: IS_PRODUCTION,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  response.cookies.set({
    name: AUTH_REFRESH_COOKIE,
    value: "",
    httpOnly: true,
    secure: IS_PRODUCTION,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}
