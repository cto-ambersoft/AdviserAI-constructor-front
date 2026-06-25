"use client";

import { useCallback, useEffect, useState } from "react";
import { KeyRound, Loader2, Mail, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { INPUT_CLASS } from "@/components/trading/form-controls";
import {
  ApiError,
  getEmail2FAStatus,
  getTotpStatus,
  requestStepUpEmailCode,
  stepUp,
  type TwoFactorMethod,
} from "@/lib/api";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  /** Called with a fresh one-time step-up token once a code is accepted. */
  onResolved: (token: string) => void;
  /** Called when the user dismisses without authorizing. */
  onCancel: () => void;
};

// Contract accepts 4–64 chars: a 6-digit TOTP, a recovery code, or an email code.
const MIN_CODE_LENGTH = 4;
const MAX_CODE_LENGTH = 64;
const DEFAULT_LOCKOUT_SECONDS = 30;

type Phase = "loading" | "pick" | "code";

export function StepUpModal({ open, onResolved, onCancel }: Props) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [factors, setFactors] = useState<TwoFactorMethod[]>([]);
  const [method, setMethod] = useState<TwoFactorMethod>("totp");

  const [code, setCode] = useState("");
  const [emailCodeSent, setEmailCodeSent] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lockoutSeconds, setLockoutSeconds] = useState(0);

  // Discover which factors the user can use. One → auto-select; both → picker. On
  // failure default to TOTP entry (the previous behaviour) so step-up still works.
  useEffect(() => {
    let cancelled = false;
    setPhase("loading");
    setError(null);
    void (async () => {
      const available: TwoFactorMethod[] = [];
      try {
        const [totp, email] = await Promise.allSettled([
          getTotpStatus(),
          getEmail2FAStatus(),
        ]);
        if (totp.status === "fulfilled" && totp.value.enabled) {
          available.push("totp");
        }
        if (
          email.status === "fulfilled" &&
          email.value.enabled &&
          email.value.available
        ) {
          available.push("email");
        }
      } catch {
        // fall through to the TOTP default
      }
      if (cancelled) {
        return;
      }
      const resolved = available.length > 0 ? available : (["totp"] as TwoFactorMethod[]);
      setFactors(resolved);
      if (resolved.length === 1) {
        setMethod(resolved[0]);
        setPhase("code");
      } else {
        setPhase("pick");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Lockout countdown (after a 429). Blocks input until it elapses. — §5.
  useEffect(() => {
    if (lockoutSeconds <= 0) {
      return;
    }
    const timer = setInterval(() => {
      setLockoutSeconds((seconds) => Math.max(0, seconds - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [lockoutSeconds]);

  const pickMethod = useCallback((next: TwoFactorMethod) => {
    setMethod(next);
    setCode("");
    setError(null);
    setEmailCodeSent(false);
    setPhase("code");
  }, []);

  const sendEmailCode = useCallback(async () => {
    setIsSendingEmail(true);
    setError(null);
    try {
      await requestStepUpEmailCode();
      setEmailCodeSent(true);
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 429) {
        const wait = caught.retryAfterSeconds ?? DEFAULT_LOCKOUT_SECONDS;
        setLockoutSeconds(wait);
        setError("Too many requests. Please wait before retrying.");
      } else {
        setError(
          caught instanceof ApiError ? caught.message : "Could not send the code.",
        );
      }
    } finally {
      setIsSendingEmail(false);
    }
  }, []);

  const trimmed = code.trim();
  const isLocked = lockoutSeconds > 0;
  const canSubmit =
    !submitting &&
    !isLocked &&
    trimmed.length >= MIN_CODE_LENGTH &&
    trimmed.length <= MAX_CODE_LENGTH;

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) {
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const { step_up_token } = await stepUp(trimmed, method);
      onResolved(step_up_token);
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 400) {
        setError("Invalid code. Please try again.");
      } else if (caught instanceof ApiError && caught.status === 429) {
        const wait = caught.retryAfterSeconds ?? DEFAULT_LOCKOUT_SECONDS;
        setLockoutSeconds(wait);
        setError("Too many attempts. Please wait before retrying.");
      } else if (caught instanceof ApiError) {
        setError(caught.message || "Could not verify the code.");
      } else {
        setError("Could not verify the code.");
      }
      setCode("");
    } finally {
      setSubmitting(false);
    }
  }, [canSubmit, trimmed, method, onResolved]);

  const isEmail = method === "email";

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !submitting) {
          onCancel();
        }
      }}
    >
      <DialogContent className="max-w-md" showCloseButton={!submitting}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="size-4 text-primary" />
            Two-factor confirmation
          </DialogTitle>
          <DialogDescription>
            {phase === "pick"
              ? "Choose how to confirm this action."
              : isEmail
                ? "Confirm this action with a code sent to your email."
                : "Enter the 6-digit code from your authenticator app (or a recovery code)."}
          </DialogDescription>
        </DialogHeader>

        {phase === "loading" ? (
          <div className="flex justify-center py-6">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : null}

        {phase === "pick" ? (
          <div className="space-y-2">
            <Button
              type="button"
              variant="outline"
              className="w-full justify-start"
              onClick={() => pickMethod("totp")}
            >
              <KeyRound className="size-4" /> Authenticator code
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full justify-start"
              onClick={() => pickMethod("email")}
            >
              <Mail className="size-4" /> Email me a code
            </Button>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={onCancel}>
                Cancel
              </Button>
            </DialogFooter>
          </div>
        ) : null}

        {phase === "code" ? (
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              void handleSubmit();
            }}
          >
            {isEmail && !emailCodeSent ? (
              <Button
                type="button"
                onClick={() => void sendEmailCode()}
                disabled={isSendingEmail || isLocked}
              >
                {isSendingEmail ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Mail className="size-4" />
                )}
                Send code
              </Button>
            ) : (
              <input
                autoFocus
                // `text`, not `numeric`: recovery/email codes contain letters. — review I1.
                inputMode="text"
                autoComplete="one-time-code"
                placeholder={isEmail ? "Email code" : "6-digit code or recovery code"}
                className={cn(INPUT_CLASS, "tracking-widest")}
                value={code}
                maxLength={MAX_CODE_LENGTH}
                disabled={submitting || isLocked}
                onChange={(event) => setCode(event.target.value)}
              />
            )}

            {isEmail && emailCodeSent ? (
              <button
                type="button"
                className="text-sm text-muted-foreground underline underline-offset-2 disabled:opacity-50"
                onClick={() => void sendEmailCode()}
                disabled={isSendingEmail || isLocked}
              >
                Resend code
              </button>
            ) : null}

            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            {isLocked ? (
              <p className="text-sm text-muted-foreground">
                You can retry in {lockoutSeconds}s.
              </p>
            ) : null}

            <DialogFooter>
              {factors.length > 1 ? (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setPhase("pick")}
                  disabled={submitting}
                >
                  Back
                </Button>
              ) : null}
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                disabled={submitting}
              >
                Cancel
              </Button>
              {!(isEmail && !emailCodeSent) ? (
                <Button type="submit" disabled={!canSubmit}>
                  {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
                  Confirm
                </Button>
              ) : null}
            </DialogFooter>
          </form>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
