"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Mail, MailCheck, ShieldOff } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { INPUT_CLASS, Label } from "@/components/trading/form-controls";
import {
  ApiError,
  confirmEmail2FA,
  disableEmail2FA,
  enrollEmail2FA,
  getEmail2FAStatus,
} from "@/lib/api";
import { notifyError, notifySuccess } from "@/lib/notifications";
import { cn } from "@/lib/utils";

const CARD_CLASS = "border-border/80 bg-card/80 shadow-sm backdrop-blur";

type LoadState = "loading" | "ready" | "error";

// Emailed codes are high-entropy tokens (~11 chars); accept 4–64 like the contract.
const MIN_CODE_LENGTH = 4;
const MAX_CODE_LENGTH = 64;
const DEFAULT_LOCKOUT_SECONDS = 30;

export function EmailTwoFactorSettings() {
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [enabled, setEnabled] = useState(false);
  const [available, setAvailable] = useState(false);

  // A code has been emailed and we're awaiting confirmation.
  const [awaitingCode, setAwaitingCode] = useState(false);
  const [code, setCode] = useState("");
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [lockoutSeconds, setLockoutSeconds] = useState(0);

  const [isEnrolling, setIsEnrolling] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isDisabling, setIsDisabling] = useState(false);

  const loadStatus = useCallback(async () => {
    try {
      const status = await getEmail2FAStatus();
      setEnabled(status.enabled);
      setAvailable(status.available);
      setLoadState("ready");
    } catch {
      setLoadState("error");
    }
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  // Confirm lockout countdown after a 429.
  useEffect(() => {
    if (lockoutSeconds <= 0) {
      return;
    }
    const timer = setInterval(() => {
      setLockoutSeconds((seconds) => Math.max(0, seconds - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [lockoutSeconds]);

  const handleEnroll = useCallback(async () => {
    setIsEnrolling(true);
    setConfirmError(null);
    try {
      await enrollEmail2FA();
      setAwaitingCode(true);
      setCode("");
      notifySuccess("We emailed you a confirmation code.");
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 503) {
        notifyError("Email-based 2FA is not configured on this server.");
        void loadStatus();
      } else {
        notifyError(
          caught instanceof ApiError
            ? caught.message
            : "Could not start email-2FA enrollment.",
        );
      }
    } finally {
      setIsEnrolling(false);
    }
  }, [loadStatus]);

  const handleConfirm = useCallback(async () => {
    const trimmed = code.trim();
    if (trimmed.length < MIN_CODE_LENGTH) {
      return;
    }
    setIsConfirming(true);
    setConfirmError(null);
    try {
      const status = await confirmEmail2FA(trimmed);
      setEnabled(status.enabled);
      setAwaitingCode(false);
      setCode("");
      notifySuccess("Email two-factor authentication enabled.");
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 400) {
        setConfirmError("Invalid or expired code. Please try again.");
      } else if (caught instanceof ApiError && caught.status === 429) {
        const wait = caught.retryAfterSeconds ?? DEFAULT_LOCKOUT_SECONDS;
        setLockoutSeconds(wait);
        setConfirmError("Too many attempts. Please wait before retrying.");
      } else {
        setConfirmError(
          caught instanceof ApiError ? caught.message : "Could not confirm code.",
        );
      }
      setCode("");
    } finally {
      setIsConfirming(false);
    }
  }, [code]);

  const handleCancelEnroll = useCallback(() => {
    setAwaitingCode(false);
    setCode("");
    setConfirmError(null);
  }, []);

  const handleDisable = useCallback(async () => {
    setIsDisabling(true);
    try {
      // Gated: the step-up interceptor prompts for a code and retries. — §1.
      const status = await disableEmail2FA();
      setEnabled(status.enabled);
      notifySuccess("Email two-factor authentication disabled.");
    } catch (caught) {
      notifyError(
        caught instanceof ApiError ? caught.message : "Could not disable email-2FA.",
      );
    } finally {
      setIsDisabling(false);
    }
  }, []);

  const isLocked = lockoutSeconds > 0;
  const canConfirm =
    !isConfirming &&
    !isLocked &&
    code.trim().length >= MIN_CODE_LENGTH &&
    code.trim().length <= MAX_CODE_LENGTH;

  return (
    <Card className={CARD_CLASS}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Email authentication
          {loadState === "ready" ? (
            <Badge variant={enabled ? "secondary" : "outline"}>
              {enabled ? "Enabled" : "Disabled"}
            </Badge>
          ) : null}
        </CardTitle>
        <CardDescription>
          Use a code emailed to your account address as a second factor — at
          sign-in and to confirm critical actions.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {loadState === "loading" ? <Skeleton className="h-24 w-full" /> : null}

        {loadState === "error" ? (
          <div className="space-y-3">
            <p className="text-sm text-destructive">
              Could not load email-2FA status.
            </p>
            <Button variant="outline" onClick={() => void loadStatus()}>
              Retry
            </Button>
          </div>
        ) : null}

        {loadState === "ready" && !available ? (
          <p className="text-sm text-muted-foreground">
            Email two-factor is not available.
          </p>
        ) : null}

        {loadState === "ready" && available && enabled ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MailCheck className="size-4 text-primary" />
              Email two-factor authentication is active.
            </div>
            <Separator />
            <p className="text-sm text-muted-foreground">
              Disabling it requires confirming a current code (step-up).
            </p>
            <Button
              variant="destructive"
              onClick={() => void handleDisable()}
              disabled={isDisabling}
            >
              {isDisabling ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <ShieldOff className="size-4" />
              )}
              Disable email 2FA
            </Button>
          </div>
        ) : null}

        {loadState === "ready" && available && !enabled && !awaitingCode ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Use an emailed code as a second factor.
            </p>
            <Button onClick={() => void handleEnroll()} disabled={isEnrolling}>
              {isEnrolling ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Mail className="size-4" />
              )}
              Enable email 2FA
            </Button>
          </div>
        ) : null}

        {loadState === "ready" && available && !enabled && awaitingCode ? (
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              void handleConfirm();
            }}
          >
            <Label text="Enter the code we emailed you" />
            <div className="flex flex-wrap items-center gap-2">
              <input
                autoFocus
                inputMode="text"
                autoComplete="one-time-code"
                placeholder="Email code"
                className={cn(INPUT_CLASS, "max-w-[220px] tracking-widest")}
                value={code}
                maxLength={MAX_CODE_LENGTH}
                disabled={isConfirming || isLocked}
                onChange={(event) => setCode(event.target.value)}
              />
              <Button type="submit" disabled={!canConfirm}>
                {isConfirming ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : null}
                Confirm &amp; enable
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={handleCancelEnroll}
                disabled={isConfirming}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void handleEnroll()}
                disabled={isEnrolling || isConfirming}
              >
                Resend code
              </Button>
            </div>
            {confirmError ? (
              <p className="text-sm text-destructive">{confirmError}</p>
            ) : null}
            {isLocked ? (
              <p className="text-sm text-muted-foreground">
                You can retry in {lockoutSeconds}s.
              </p>
            ) : null}
          </form>
        ) : null}
      </CardContent>
    </Card>
  );
}
