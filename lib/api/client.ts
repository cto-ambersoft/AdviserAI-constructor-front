import type { ApiValidationError } from "@/lib/api/types";
import { clearAccessToken, getAccessToken, setAccessToken } from "@/lib/auth/token-storage";
import { normalizeTokenBundle } from "@/lib/auth/token-contract";

const ERROR_CODE_BY_STATUS: Record<number, string> = {
  401: "unauthorized",
  404: "not_found",
  409: "conflict",
  422: "validation_error",
  429: "rate_limited",
  503: "service_unavailable",
};

export class ApiError extends Error {
  status: number;
  code: string;
  data: unknown;
  isTemporary: boolean;
  isRateLimited: boolean;

  constructor(status: number, data: unknown, message?: string) {
    const code = extractErrorCode(status, data);
    super(message ?? formatApiErrorMessage(status, code, data));
    this.status = status;
    this.code = code;
    this.data = data;
    this.isRateLimited = status === 429 || code === "rate_limited";
    this.isTemporary = this.isRateLimited || status === 503 || code === "service_unavailable";
  }
}

const DEFAULT_API_BASE_URL = "http://localhost:8000";

export function getApiBaseUrl(): string {
  const value = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  if (!value) {
    return DEFAULT_API_BASE_URL;
  }

  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function withQuery(path: string, query?: Record<string, string | number | boolean | undefined>) {
  if (!query) {
    return path;
  }

  const searchParams = new URLSearchParams();
  for (const [key, rawValue] of Object.entries(query)) {
    if (rawValue === undefined) {
      continue;
    }
    searchParams.set(key, String(rawValue));
  }

  const suffix = searchParams.toString();
  if (!suffix) {
    return path;
  }

  return `${path}?${suffix}`;
}

function normalizePath(path: string): string {
  return path.startsWith("/") ? path : `/${path}`;
}

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
  skipAuthRefresh?: boolean;
};

let refreshPromise: Promise<string | null> | null = null;

function redirectToLogin() {
  if (typeof window === "undefined") {
    return;
  }

  const currentPath = window.location.pathname;
  if (currentPath.startsWith("/login") || currentPath.startsWith("/signup")) {
    return;
  }

  const nextPath = `${window.location.pathname}${window.location.search}`;
  const encodedNext = encodeURIComponent(nextPath || "/");
  window.location.assign(`/login?next=${encodedNext}`);
}

function shouldSkipRefresh(path: string): boolean {
  const normalized = normalizePath(path);
  return (
    normalized === "/api/auth/refresh" ||
    normalized === "/api/auth/signin" ||
    normalized === "/api/auth/signup" ||
    normalized === "/api/auth/logout"
  );
}

function buildRequestHeaders(token: string | null, hasBody: boolean) {
  const headers: Record<string, string> = {};
  if (hasBody) {
    headers["Content-Type"] = "application/json";
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

async function parseResponsePayload(response: Response): Promise<unknown> {
  if (response.status === 204) {
    return undefined;
  }

  const isJson = response.headers.get("content-type")?.includes("application/json");
  return isJson ? ((await response.json()) as unknown) : await response.text();
}

async function refreshAccessToken(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const response = await fetch("/api/auth/refresh", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
        cache: "no-store",
        credentials: "same-origin",
      });

      if (!response.ok) {
        clearAccessToken();
        return null;
      }

      const payload = (await response.json()) as unknown;
      const tokens = normalizeTokenBundle(payload);
      if (!tokens) {
        clearAccessToken();
        return null;
      }

      setAccessToken(tokens.access_token);
      return tokens.access_token;
    })().finally(() => {
      refreshPromise = null;
    });
  }

  return refreshPromise;
}

function getResponseErrorMessage(status: number, data: unknown) {
  return status === 422 ? formatValidationError(data as ApiValidationError) : undefined;
}

async function performRequest(
  method: RequestOptions["method"],
  url: string,
  body: unknown,
  token: string | null,
): Promise<Response> {
  const credentials: RequestCredentials = url.startsWith("/") ? "same-origin" : "omit";

  return fetch(url, {
    method,
    headers: buildRequestHeaders(token, body !== undefined),
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
    credentials,
  });
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", query, body, skipAuthRefresh = false } = options;
  const normalizedPath = normalizePath(path);
  const requestPath = withQuery(normalizedPath, query);
  const url = isFrontendProxyPath(normalizedPath) ? requestPath : `${getApiBaseUrl()}${requestPath}`;
  const token = getAccessToken();

  const response = await performRequest(method, url, body, token);
  const payload = await parseResponsePayload(response);

  if (response.ok) {
    return payload as T;
  }

  const canAttemptRefresh = !skipAuthRefresh && !shouldSkipRefresh(normalizedPath) && response.status === 401;
  if (canAttemptRefresh) {
    const freshAccessToken = await refreshAccessToken();
    if (freshAccessToken) {
      const retriedResponse = await performRequest(method, url, body, freshAccessToken);
      const retryPayload = await parseResponsePayload(retriedResponse);

      if (retriedResponse.ok) {
        return retryPayload as T;
      }

      const message = getResponseErrorMessage(retriedResponse.status, retryPayload);
      throw new ApiError(retriedResponse.status, retryPayload, message);
    }

    clearAccessToken();
    redirectToLogin();
  }

  const message = getResponseErrorMessage(response.status, payload);
  throw new ApiError(response.status, payload, message);
}

function isFrontendProxyPath(path: string) {
  return path.startsWith("/api/") && !path.startsWith("/api/v1/");
}

function formatApiErrorMessage(status: number, code: string, data: unknown): string {
  if (typeof data === "object" && data !== null) {
    const record = data as Record<string, unknown>;
    if (typeof record.detail === "string" && record.detail.trim().length > 0) {
      return record.detail;
    }
    if (typeof record.message === "string" && record.message.trim().length > 0) {
      return record.message;
    }
  }

  if (status in ERROR_CODE_BY_STATUS) {
    return `${ERROR_CODE_BY_STATUS[status]} (HTTP ${status})`;
  }

  return code ? `${code} (HTTP ${status})` : `HTTP ${status}`;
}

function extractErrorCode(status: number, data: unknown): string {
  if (typeof data === "object" && data !== null) {
    const record = data as Record<string, unknown>;
    const rawCode = record.code ?? record.error_code ?? record.status;
    if (typeof rawCode === "string" && rawCode.trim().length > 0) {
      return rawCode.trim().toLowerCase();
    }
  }

  return ERROR_CODE_BY_STATUS[status] ?? "request_failed";
}

export function formatValidationError(error: ApiValidationError | undefined): string {
  if (!error?.detail || error.detail.length === 0) {
    return "Validation failed";
  }

  return error.detail
    .map((item) => `${item.loc.join(".")}: ${item.msg}`)
    .join("; ");
}
