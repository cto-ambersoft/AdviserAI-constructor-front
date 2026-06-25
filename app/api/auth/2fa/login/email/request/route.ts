import { NextResponse } from "next/server";

// Login-2FA email-code request (E5/F3): proxy { challenge_token } to the backend so
// it emails an email_2fa_login code. No tokens/cookies are set here — the code is
// then submitted to /api/auth/2fa/login with method "email". Errors (401 expired
// challenge, 429 lockout) are forwarded verbatim with Retry-After preserved.

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
  const backendResponse = await fetch(
    `${getBackendBaseUrl()}/api/v1/auth/2fa/login/email/request`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    },
  );

  const contentType = backendResponse.headers.get("content-type") ?? "application/json";
  const responseBody = contentType.includes("application/json")
    ? ((await backendResponse.json()) as unknown)
    : await backendResponse.text();

  const response = NextResponse.json(responseBody, { status: backendResponse.status });
  const retryAfter = backendResponse.headers.get("retry-after");
  if (retryAfter) {
    response.headers.set("retry-after", retryAfter);
  }
  return response;
}
