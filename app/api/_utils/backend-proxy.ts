import { cookies } from "next/headers";
import { AUTH_ACCESS_COOKIE } from "@/lib/auth/constants";

const DEFAULT_API_BASE_URL = "http://localhost:8000";

function getBackendBaseUrl() {
  const value = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  if (!value) {
    return DEFAULT_API_BASE_URL;
  }
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function buildBackendUrl(path: string, searchParams?: URLSearchParams) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const base = getBackendBaseUrl();
  const suffix = searchParams?.toString();
  return suffix ? `${base}${normalizedPath}?${suffix}` : `${base}${normalizedPath}`;
}

export async function backendMutationProxy(path: string, request: Request, method: "POST" | "PATCH" | "DELETE") {
  return backendProxy(path, request, method);
}

export async function backendReadProxy(path: string, request: Request) {
  return backendProxy(path, request, "GET");
}

async function backendProxy(path: string, request: Request, method: "GET" | "POST" | "PATCH" | "DELETE") {
  const cookieToken = (await cookies()).get(AUTH_ACCESS_COOKIE)?.value;
  const incomingAuthHeader = request.headers.get("authorization");
  const hasBearerHeader = incomingAuthHeader?.toLowerCase().startsWith("bearer ");
  const headers = new Headers();
  if (method !== "GET") {
    headers.set("content-type", "application/json");
  }
  if (hasBearerHeader && incomingAuthHeader) {
    headers.set("authorization", incomingAuthHeader);
  } else if (cookieToken) {
    headers.set("authorization", `Bearer ${cookieToken}`);
  }

  const cloned = request.clone();
  const bodyText = method === "GET" || method === "DELETE" ? null : await cloned.text();
  const backendResponse = await fetch(buildBackendUrl(path, new URL(request.url).searchParams), {
    method,
    headers,
    body: bodyText && bodyText.length > 0 ? bodyText : undefined,
    cache: "no-store",
  });

  if (backendResponse.status === 204) {
    return new Response(null, { status: 204 });
  }

  const contentType = backendResponse.headers.get("content-type") ?? "application/json";
  const payload = await backendResponse.text();
  return new Response(payload, {
    status: backendResponse.status,
    headers: {
      "content-type": contentType,
    },
  });
}
