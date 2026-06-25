import { cookies } from "next/headers";
import { AUTH_ACCESS_COOKIE } from "@/lib/auth/constants";

// SSE BFF proxy (F5). Browser `EventSource` can't send Authorization, so this
// same-origin route reads the httpOnly access-token cookie, calls the backend
// stream with a Bearer header, and pipes the body straight back. The token is
// NEVER placed in the query-string. — TZ §4.1.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_API_BASE_URL = "http://localhost:8000";

function getBackendBaseUrl() {
  const value = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  if (!value) {
    return DEFAULT_API_BASE_URL;
  }
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function jsonResponse(status: number, detail: string, retryAfter?: string | null) {
  return new Response(JSON.stringify({ detail }), {
    status,
    headers: {
      "content-type": "application/json",
      ...(retryAfter ? { "retry-after": retryAfter } : {}),
    },
  });
}

export async function GET(request: Request) {
  const token = (await cookies()).get(AUTH_ACCESS_COOKIE)?.value;
  if (!token) {
    return jsonResponse(401, "Not authenticated");
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${getBackendBaseUrl()}/api/v1/events/stream`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "text/event-stream",
      },
      cache: "no-store",
      // Propagate client disconnect upstream so the backend generator tears the
      // stream down cleanly (it checks request.is_disconnected()).
      signal: request.signal,
    });
  } catch {
    return jsonResponse(502, "Event stream upstream unavailable");
  }

  // Forward a non-OK upstream (e.g. 429 stream cap, 401) verbatim — NOT as a
  // stream — preserving Retry-After so the client can respect backoff. — §4.2/§5.
  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text().catch(() => "");
    return new Response(detail || null, {
      status: upstream.status,
      headers: {
        "content-type":
          upstream.headers.get("content-type") ?? "application/json",
        ...(upstream.headers.get("retry-after")
          ? { "retry-after": upstream.headers.get("retry-after") as string }
          : {}),
      },
    });
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-store, no-transform",
      // Disable proxy buffering (nginx) so events flush immediately.
      "X-Accel-Buffering": "no",
    },
  });
}
