import { NextResponse } from "next/server";
import { normalizeTokenBundle } from "@/lib/auth/token-contract";
import { setSessionCookies } from "@/app/api/auth/_utils/session-cookies";

// Login-2FA finisher (§1b): exchange { challenge_token, code } for the token
// bundle and set the session cookies, mirroring the signin route. Errors are
// forwarded verbatim (400 bad code, 401 expired challenge, 429 lockout) with
// Retry-After preserved so the client can drive a lockout countdown.

const DEFAULT_API_BASE_URL = "http://localhost:8000";

function getBackendBaseUrl() {
  const value = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  if (!value) {
    return DEFAULT_API_BASE_URL;
  }

  return value.endsWith("/") ? value.slice(0, -1) : value;
}

export async function POST(request: Request) {
  const payload = await request.json();
  const backendResponse = await fetch(`${getBackendBaseUrl()}/api/v1/auth/2fa/login`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  const contentType = backendResponse.headers.get("content-type") ?? "application/json";
  const responseBody = contentType.includes("application/json")
    ? ((await backendResponse.json()) as unknown)
    : await backendResponse.text();

  if (!backendResponse.ok) {
    const failed = NextResponse.json(responseBody, { status: backendResponse.status });
    const retryAfter = backendResponse.headers.get("retry-after");
    if (retryAfter) {
      failed.headers.set("retry-after", retryAfter);
    }
    return failed;
  }

  const tokens = normalizeTokenBundle(responseBody);
  if (!tokens) {
    return NextResponse.json({ detail: "Invalid token payload from backend" }, { status: 502 });
  }

  const response = NextResponse.json(tokens, { status: 200 });
  setSessionCookies(response, tokens);
  return response;
}
