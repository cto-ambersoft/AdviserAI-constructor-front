import { NextResponse } from "next/server";
import { normalizeTokenBundle } from "@/lib/auth/token-contract";
import { setSessionCookies } from "@/app/api/auth/_utils/session-cookies";

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
  const backendResponse = await fetch(`${getBackendBaseUrl()}/api/v1/auth/signup`, {
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
    return NextResponse.json(responseBody, { status: backendResponse.status });
  }

  const tokens = normalizeTokenBundle(responseBody);
  if (!tokens) {
    return NextResponse.json({ detail: "Invalid token payload from backend" }, { status: 502 });
  }

  const response = NextResponse.json(tokens, { status: 200 });
  setSessionCookies(response, tokens);
  return response;
}
