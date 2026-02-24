import { ApiError } from "@/lib/api/client";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type RetryOptions = {
  retries?: number;
  initialDelayMs?: number;
};

export async function withApiRetry<T>(
  run: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const retries = options.retries ?? 2;
  const initialDelayMs = options.initialDelayMs ?? 400;
  let attempt = 0;

  // Exponential backoff for 429/503 and temporary network issues.
  for (;;) {
    try {
      return await run();
    } catch (error) {
      if (attempt >= retries) {
        throw error;
      }

      const retriable =
        error instanceof ApiError
          ? error.isTemporary || error.status === 429 || error.status === 503
          : error instanceof TypeError;
      if (!retriable) {
        throw error;
      }

      const delay = initialDelayMs * 2 ** attempt;
      await wait(delay);
      attempt += 1;
    }
  }
}
