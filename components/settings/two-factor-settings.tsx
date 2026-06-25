"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, ShieldCheck, ShieldOff, Copy, Download } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

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
  disableTotp,
  enrollTotp,
  getTotpStatus,
  verifyTotp,
  type TotpEnrollResponse,
} from "@/lib/api";
import { notifyError, notifySuccess } from "@/lib/notifications";
import { cn } from "@/lib/utils";

const CARD_CLASS = "border-border/80 bg-card/80 shadow-sm backdrop-blur";

type LoadState = "loading" | "ready" | "error";

// 6-digit TOTP only at verify (recovery codes are rejected there). — F4 §2.2.
const TOTP_LENGTH = 6;
const DEFAULT_LOCKOUT_SECONDS = 30;

export function TwoFactorSettings() {
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [enabled, setEnabled] = useState(false);
  const [enroll, setEnroll] = useState<TotpEnrollResponse | null>(null);

  const [verifyCode, setVerifyCode] = useState("");
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [lockoutSeconds, setLockoutSeconds] = useState(0);

  const [isEnrolling, setIsEnrolling] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isDisabling, setIsDisabling] = useState(false);

  const loadStatus = useCallback(async () => {
    try {
      const status = await getTotpStatus();
      setEnabled(status.enabled);
      setLoadState("ready");
    } catch {
      setLoadState("error");
    }
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  // Verify lockout countdown after a 429. Blocks the verify input. — §5.
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
    setVerifyError(null);
    try {
      const response = await enrollTotp();
      setEnroll(response);
      setVerifyCode("");
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 409) {
        notifyError("2FA is already enabled. Disable it first to re-enroll.");
        void loadStatus();
      } else {
        notifyError(
          caught instanceof ApiError
            ? caught.message
            : "Could not start 2FA enrollment.",
        );
      }
    } finally {
      setIsEnrolling(false);
    }
  }, [loadStatus]);

  const handleVerify = useCallback(async () => {
    const code = verifyCode.trim();
    if (code.length !== TOTP_LENGTH) {
      return;
    }
    setIsVerifying(true);
    setVerifyError(null);
    try {
      const status = await verifyTotp(code);
      setEnabled(status.enabled);
      setEnroll(null); // recovery codes leave memory once verified
      setVerifyCode("");
      notifySuccess("Two-factor authentication enabled.");
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 400) {
        setVerifyError("Invalid code. Please try again.");
      } else if (caught instanceof ApiError && caught.status === 429) {
        const wait = caught.retryAfterSeconds ?? DEFAULT_LOCKOUT_SECONDS;
        setLockoutSeconds(wait);
        setVerifyError("Too many attempts. Please wait before retrying.");
      } else {
        setVerifyError(
          caught instanceof ApiError ? caught.message : "Could not verify code.",
        );
      }
      setVerifyCode("");
    } finally {
      setIsVerifying(false);
    }
  }, [verifyCode]);

  const handleCancelEnroll = useCallback(() => {
    setEnroll(null);
    setVerifyCode("");
    setVerifyError(null);
  }, []);

  const handleDisable = useCallback(async () => {
    setIsDisabling(true);
    try {
      // Gated: the step-up interceptor prompts for a code and retries. — §1.
      const status = await disableTotp();
      setEnabled(status.enabled);
      notifySuccess("Two-factor authentication disabled.");
    } catch (caught) {
      notifyError(
        caught instanceof ApiError
          ? caught.message
          : "Could not disable 2FA.",
      );
    } finally {
      setIsDisabling(false);
    }
  }, []);

  const copyRecoveryCodes = useCallback(async () => {
    if (!enroll) {
      return;
    }
    try {
      await navigator.clipboard.writeText(enroll.recovery_codes.join("\n"));
      notifySuccess("Recovery codes copied.");
    } catch {
      notifyError("Clipboard unavailable — copy the codes manually.");
    }
  }, [enroll]);

  const downloadRecoveryCodes = useCallback(() => {
    if (!enroll) {
      return;
    }
    const blob = new Blob([enroll.recovery_codes.join("\n")], {
      type: "text/plain",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "recovery-codes.txt";
    anchor.click();
    URL.revokeObjectURL(url);
  }, [enroll]);

  return (
    <Card className={CARD_CLASS}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Two-Factor Authentication
            {loadState === "ready" ? (
              <Badge variant={enabled ? "secondary" : "outline"}>
                {enabled ? "Enabled" : "Disabled"}
              </Badge>
            ) : null}
          </CardTitle>
          <CardDescription>
            Require an authenticator-app code for critical actions.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {loadState === "loading" ? (
            <Skeleton className="h-24 w-full" />
          ) : null}

          {loadState === "error" ? (
            <div className="space-y-3">
              <p className="text-sm text-destructive">
                Could not load 2FA status.
              </p>
              <Button variant="outline" onClick={() => void loadStatus()}>
                Retry
              </Button>
            </div>
          ) : null}

          {loadState === "ready" && enabled ? (
            <EnabledPanel
              isDisabling={isDisabling}
              onDisable={() => void handleDisable()}
            />
          ) : null}

          {loadState === "ready" && !enabled && !enroll ? (
            <DisabledPanel
              isEnrolling={isEnrolling}
              onEnroll={() => void handleEnroll()}
            />
          ) : null}

          {loadState === "ready" && !enabled && enroll ? (
            <EnrollPanel
              enroll={enroll}
              verifyCode={verifyCode}
              verifyError={verifyError}
              lockoutSeconds={lockoutSeconds}
              isVerifying={isVerifying}
              onCodeChange={setVerifyCode}
              onVerify={() => void handleVerify()}
              onCancel={handleCancelEnroll}
              onCopy={() => void copyRecoveryCodes()}
              onDownload={downloadRecoveryCodes}
            />
          ) : null}
        </CardContent>
      </Card>
  );
}

function DisabledPanel({
  isEnrolling,
  onEnroll,
}: {
  isEnrolling: boolean;
  onEnroll: () => void;
}) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Two-factor authentication is off.
      </p>
      <Button onClick={onEnroll} disabled={isEnrolling}>
        {isEnrolling ? <Loader2 className="size-4 animate-spin" /> : (
          <ShieldCheck className="size-4" />
        )}
        Enable 2FA
      </Button>
    </div>
  );
}

function EnabledPanel({
  isDisabling,
  onDisable,
}: {
  isDisabling: boolean;
  onDisable: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <ShieldCheck className="size-4 text-primary" />
        Two-factor authentication is active. Critical actions require a fresh
        code.
      </div>
      <Separator />
      <p className="text-sm text-muted-foreground">
        Disabling 2FA requires confirming a current code (step-up).
      </p>
      <Button
        variant="destructive"
        onClick={onDisable}
        disabled={isDisabling}
      >
        {isDisabling ? <Loader2 className="size-4 animate-spin" /> : (
          <ShieldOff className="size-4" />
        )}
        Disable 2FA
      </Button>
    </div>
  );
}

function EnrollPanel({
  enroll,
  verifyCode,
  verifyError,
  lockoutSeconds,
  isVerifying,
  onCodeChange,
  onVerify,
  onCancel,
  onCopy,
  onDownload,
}: {
  enroll: TotpEnrollResponse;
  verifyCode: string;
  verifyError: string | null;
  lockoutSeconds: number;
  isVerifying: boolean;
  onCodeChange: (code: string) => void;
  onVerify: () => void;
  onCancel: () => void;
  onCopy: () => void;
  onDownload: () => void;
}) {
  const isLocked = lockoutSeconds > 0;
  const canVerify =
    !isVerifying && !isLocked && verifyCode.trim().length === TOTP_LENGTH;

  return (
    <div className="space-y-5">
      <div className="grid gap-5 md:grid-cols-[auto_1fr] md:items-start">
        <div className="w-fit rounded-md bg-white p-3">
          <QRCodeSVG value={enroll.provisioning_uri} size={192} level="M" />
        </div>
        <div className="space-y-2">
          <Label text="1 · Scan the QR in your authenticator app" />
          <p className="text-sm text-muted-foreground">
            Or enter this secret manually:
          </p>
          <code className="block break-all rounded-md border border-border/80 bg-muted/40 px-3 py-2 font-mono text-sm">
            {enroll.secret}
          </code>
        </div>
      </div>

      <Separator />

      {/* Recovery codes — shown ONCE. Never re-displayed by the backend. */}
      <div className="space-y-2">
        <Label text="2 · Save your recovery codes" />
        <p className="text-sm text-amber-400">
          Store these now — they are shown only once and let you sign in if you
          lose your authenticator.
        </p>
        <div className="grid grid-cols-2 gap-2 rounded-md border border-border/80 bg-muted/30 p-3 font-mono text-sm sm:grid-cols-5">
          {enroll.recovery_codes.map((code) => (
            <span key={code} className="break-all">
              {code}
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onCopy}>
            <Copy className="size-4" /> Copy
          </Button>
          <Button variant="outline" size="sm" onClick={onDownload}>
            <Download className="size-4" /> Download
          </Button>
        </div>
      </div>

      <Separator />

      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          onVerify();
        }}
      >
        <Label text="3 · Enter a 6-digit code to finish" />
        <div className="flex flex-wrap items-center gap-2">
          <input
            autoFocus
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="123456"
            className={cn(INPUT_CLASS, "max-w-[160px] tracking-widest")}
            value={verifyCode}
            maxLength={TOTP_LENGTH}
            disabled={isVerifying || isLocked}
            onChange={(event) => onCodeChange(event.target.value)}
          />
          <Button type="submit" disabled={!canVerify}>
            {isVerifying ? <Loader2 className="size-4 animate-spin" /> : null}
            Verify &amp; enable
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={onCancel}
            disabled={isVerifying}
          >
            Cancel
          </Button>
        </div>
        {verifyError ? (
          <p className="text-sm text-destructive">{verifyError}</p>
        ) : null}
        {isLocked ? (
          <p className="text-sm text-muted-foreground">
            You can retry in {lockoutSeconds}s.
          </p>
        ) : null}
      </form>
    </div>
  );
}
