let memoryToken: string | null = null;

export function getAccessToken() {
  return memoryToken;
}

export function setAccessToken(token: string) {
  memoryToken = token;
}

export function clearAccessToken() {
  memoryToken = null;
}
