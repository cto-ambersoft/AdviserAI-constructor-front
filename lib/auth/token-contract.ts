export type AuthTokenBundle = {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  refresh_expires_in: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isTokenBundle(value: unknown): value is AuthTokenBundle {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.access_token === "string" &&
    typeof value.refresh_token === "string" &&
    typeof value.token_type === "string" &&
    typeof value.expires_in === "number" &&
    typeof value.refresh_expires_in === "number"
  );
}

export function normalizeTokenBundle(payload: unknown): AuthTokenBundle | null {
  if (isTokenBundle(payload)) {
    return payload;
  }

  if (isRecord(payload) && isTokenBundle(payload.token)) {
    return payload.token;
  }

  return null;
}
