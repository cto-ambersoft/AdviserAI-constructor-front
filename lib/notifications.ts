import { toast, type ExternalToast } from "sonner";
import { ApiError, formatValidationError, type ApiValidationError } from "@/lib/api";

const DEFAULT_INFO_DURATION_MS = 3500;
const DEFAULT_SUCCESS_DURATION_MS = 3500;
const DEFAULT_WARNING_DURATION_MS = 7000;
const DEFAULT_ERROR_DURATION_MS = 8000;
const DEFAULT_DEDUPE_MS = 10_000;

type NotifyOptions = ExternalToast & {
  dedupeKey?: string;
  dedupeMs?: number;
};

type ApiErrorOptions = Omit<NotifyOptions, "description"> & {
  fallback?: string;
};

const dedupeUntilByKey = new Map<string, number>();

function shouldSkipByDedupe(key: string | undefined, dedupeMs = DEFAULT_DEDUPE_MS): boolean {
  if (!key) {
    return false;
  }

  const now = Date.now();
  const knownUntil = dedupeUntilByKey.get(key) ?? 0;
  if (knownUntil > now) {
    return true;
  }

  dedupeUntilByKey.set(key, now + dedupeMs);
  return false;
}

function withDedupe(options: NotifyOptions | undefined) {
  if (!options) {
    return { shouldSkip: false, toastOptions: {} as ExternalToast };
  }

  const { dedupeKey, dedupeMs, ...toastOptions } = options;
  const shouldSkip = shouldSkipByDedupe(dedupeKey, dedupeMs);
  return { shouldSkip, toastOptions };
}

function getApiMessage(error: unknown, fallback = "Request failed"): string {
  if (error instanceof ApiError) {
    if (error.status === 422) {
      const normalized = formatValidationError(error.data as ApiValidationError);
      if (normalized.trim().length > 0) {
        return normalized;
      }
    }

    if (typeof error.message === "string" && error.message.trim().length > 0) {
      return error.message;
    }

    return fallback;
  }

  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return fallback;
}

export function notifyInfo(message: string, options?: NotifyOptions) {
  const { shouldSkip, toastOptions } = withDedupe(options);
  if (shouldSkip) {
    return;
  }
  toast(message, {
    duration: DEFAULT_INFO_DURATION_MS,
    ...toastOptions,
  });
}

export function notifySuccess(message: string, options?: NotifyOptions) {
  const { shouldSkip, toastOptions } = withDedupe(options);
  if (shouldSkip) {
    return;
  }
  toast.success(message, {
    duration: DEFAULT_SUCCESS_DURATION_MS,
    ...toastOptions,
  });
}

export function notifyWarning(message: string, options?: NotifyOptions) {
  const { shouldSkip, toastOptions } = withDedupe(options);
  if (shouldSkip) {
    return;
  }
  toast.warning(message, {
    closeButton: true,
    duration: DEFAULT_WARNING_DURATION_MS,
    dismissible: true,
    ...toastOptions,
  });
}

export function notifyError(message: string, options?: NotifyOptions) {
  const { shouldSkip, toastOptions } = withDedupe(options);
  if (shouldSkip) {
    return;
  }
  toast.error(message, {
    closeButton: true,
    duration: DEFAULT_ERROR_DURATION_MS,
    dismissible: true,
    ...toastOptions,
  });
}

export function notifyApiError(error: unknown, options?: ApiErrorOptions) {
  const { fallback, ...notifyOptions } = options ?? {};
  const message = getApiMessage(error, fallback ?? "Request failed");
  notifyError(message, notifyOptions);
}
