import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { AUTH_REFRESH_COOKIE } from "@/lib/auth/constants";
import { normalizeTokenBundle } from "@/lib/auth/token-contract";
import { clearSessionCookies, setSessionCookies } from "@/app/api/auth/_utils/session-cookies";

const DEFAULT_API_BASE_URL = "http://localhost:8000";

function getBackendBaseUrl() {
  const value = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  if (!value) {
    return DEFAULT_API_BASE_URL;
  }

  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function extractRefreshToken(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const cookieRefreshToken = extractRefreshToken(cookieStore.get(AUTH_REFRESH_COOKIE)?.value);

  let bodyRefreshToken: string | null = null;
  try {
    const body = (await request.json()) as { refresh_token?: unknown };
    bodyRefreshToken = extractRefreshToken(body.refresh_token);
  } catch {
    bodyRefreshToken = null;
  }

  const refreshToken = cookieRefreshToken ?? bodyRefreshToken;
  if (!refreshToken) {
    const unauthorizedResponse = NextResponse.json({ detail: "Refresh token is missing" }, { status: 401 });
    clearSessionCookies(unauthorizedResponse);
    return unauthorizedResponse;
  }

  const backendResponse = await fetch(`${getBackendBaseUrl()}/api/v1/auth/refresh`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({ refresh_token: refreshToken }),
    cache: "no-store",
  });

  const contentType = backendResponse.headers.get("content-type") ?? "application/json";
  const responseBody = contentType.includes("application/json")
    ? ((await backendResponse.json()) as unknown)
    : await backendResponse.text();

  if (!backendResponse.ok) {
    const failedResponse = NextResponse.json(responseBody, { status: backendResponse.status });
    if (backendResponse.status === 401) {
      clearSessionCookies(failedResponse);
    }
    return failedResponse;
  }

  const tokens = normalizeTokenBundle(responseBody);
  if (!tokens) {
    const invalidResponse = NextResponse.json({ detail: "Invalid token payload from backend" }, { status: 502 });
    clearSessionCookies(invalidResponse);
    return invalidResponse;
  }

  const response = NextResponse.json(tokens, { status: 200 });
  setSessionCookies(response, tokens);
  return response;
}
