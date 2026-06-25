"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ApiError, requestLoginEmailCode, type TwoFactorMethod } from "@/lib/api";
import { getApiErrorMessage, useAuthStore } from "@/stores/auth-store";

type AuthMode = "signin" | "signup";

const AUTH_INPUT_CLASS =
  "h-10 w-full rounded-md border border-input/80 bg-background/70 px-3 text-sm text-foreground shadow-xs outline-none ring-offset-background transition-colors placeholder:text-muted-foreground/90 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/35";

// Login-2FA code: 6-digit TOTP, a 16-char recovery code, or an email code (≥4). — §1b/E5.
const MIN_CODE_LENGTH = 4;
const MAX_CODE_LENGTH = 64;
const DEFAULT_LOCKOUT_SECONDS = 30;

export function AuthFormCard({ mode }: { mode: AuthMode }) {
  const searchParams = useSearchParams();
  const redirectToNext = (target: string) => {
    if (typeof window === "undefined") {
      return;
    }

    // Use hard navigation here to avoid stale RSC transition races right after token write.
    window.location.replace(target);
  };

  const login = useAuthStore((state) => state.login);
  const completeTwoFactorLogin = useAuthStore((state) => state.completeTwoFactorLogin);
  const register = useAuthStore((state) => state.register);
  const status = useAuthStore((state) => state.status);
  const hasHydrated = useAuthStore((state) => state.hasHydrated);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [generalError, setGeneralError] = useState("");
  const [emailError, setEmailError] = useState("");

  // Login-2FA (§1b): a non-null challenge token switches the form to the
  // code-entry phase. No tokens/cookies exist yet at this point.
  const [challengeToken, setChallengeToken] = useState<string | null>(null);
  // Which factors the user can use, and the one currently selected (null → picker).
  const [factors, setFactors] = useState<TwoFactorMethod[]>([]);
  const [method, setMethod] = useState<TwoFactorMethod | null>(null);
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [emailCodeSent, setEmailCodeSent] = useState(false);
  const [isSendingEmailCode, setIsSendingEmailCode] = useState(false);
  const [lockoutSeconds, setLockoutSeconds] = useState(0);

  const nextTarget = useMemo(() => {
    const raw = searchParams.get("next")?.trim();
    if (!raw || !raw.startsWith("/") || raw.startsWith("//")) {
      return "/";
    }
    return raw;
  }, [searchParams]);

  const isSignUp = mode === "signup";
  const title = isSignUp ? "Create account" : "Sign in";
  const description = isSignUp
    ? "Create your account to access trading dashboard."
    : "Sign in with your email and password.";

  const submitText = isSignUp ? "Sign up" : "Sign in";
  const secondaryHref = isSignUp ? "/login" : "/signup";
  const secondaryText = isSignUp ? "Already have an account? Sign in" : "No account yet? Sign up";

  useEffect(() => {
    if (!hasHydrated || status !== "authenticated") {
      return;
    }

    redirectToNext(nextTarget);
  }, [hasHydrated, nextTarget, status]);

  // Lockout countdown after a 429 — blocks the code input until it elapses. — §5.
  useEffect(() => {
    if (lockoutSeconds <= 0) {
      return;
    }
    const timer = setInterval(() => {
      setLockoutSeconds((seconds) => Math.max(0, seconds - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [lockoutSeconds]);

  const resetTwoFactor = () => {
    setChallengeToken(null);
    setFactors([]);
    setMethod(null);
    setTwoFactorCode("");
    setEmailCodeSent(false);
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setGeneralError("");
    setEmailError("");
    setIsSubmitting(true);

    try {
      if (isSignUp) {
        await register({ email: email.trim(), password });
        redirectToNext(nextTarget);
      } else {
        const result = await login({ email: email.trim(), password });
        if (result.twoFactorRequired) {
          // Switch to the code-entry phase; login finishes via onSubmitTwoFactor.
          // Fall back to TOTP if the backend didn't advertise factors (older API).
          const advertised =
            result.factors.length > 0 ? result.factors : (["totp"] as TwoFactorMethod[]);
          setChallengeToken(result.challengeToken);
          setFactors(advertised);
          setMethod(advertised.length === 1 ? advertised[0] : null);
          setTwoFactorCode("");
          setEmailCodeSent(false);
          setIsSubmitting(false);
          return;
        }
        redirectToNext(nextTarget);
      }
    } catch (error) {
      if (error instanceof ApiError) {
        const detail = getApiErrorMessage(error);

        if (isSignUp && error.status === 409) {
          setEmailError(detail ?? "User with this email already exists");
        } else if (!isSignUp && error.status === 401) {
          setGeneralError(detail ?? "Incorrect email or password");
        } else if (error.status === 403) {
          setGeneralError(detail ?? "User is inactive");
        } else {
          setGeneralError(detail ?? error.message);
        }
      } else {
        setGeneralError(error instanceof Error ? error.message : "Request failed");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const sendEmailCode = async () => {
    if (!challengeToken) {
      return;
    }
    setIsSendingEmailCode(true);
    setGeneralError("");
    try {
      await requestLoginEmailCode({ challenge_token: challengeToken });
      setEmailCodeSent(true);
    } catch (error) {
      if (error instanceof ApiError && error.status === 429) {
        const wait = error.retryAfterSeconds ?? DEFAULT_LOCKOUT_SECONDS;
        setLockoutSeconds(wait);
        setGeneralError("Too many attempts. Please wait before retrying.");
      } else if (error instanceof ApiError && error.status === 401) {
        resetTwoFactor();
        setGeneralError("Your sign-in session expired. Please sign in again.");
      } else {
        setGeneralError(
          error instanceof ApiError ? getApiErrorMessage(error) ?? error.message : "Could not send the code.",
        );
      }
    } finally {
      setIsSendingEmailCode(false);
    }
  };

  const onSubmitTwoFactor = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!challengeToken || !method) {
      return;
    }
    setGeneralError("");
    setIsSubmitting(true);

    try {
      await completeTwoFactorLogin({
        challenge_token: challengeToken,
        method,
        code: twoFactorCode.trim(),
      });
      redirectToNext(nextTarget);
    } catch (error) {
      if (error instanceof ApiError && error.status === 400) {
        setGeneralError("Invalid code. Please try again.");
      } else if (error instanceof ApiError && error.status === 429) {
        const wait = error.retryAfterSeconds ?? DEFAULT_LOCKOUT_SECONDS;
        setLockoutSeconds(wait);
        setGeneralError("Too many attempts. Please wait before retrying.");
      } else if (error instanceof ApiError && error.status === 401) {
        // Challenge expired/invalid — restart from credentials. — §1b.
        resetTwoFactor();
        setGeneralError("Your sign-in session expired. Please sign in again.");
      } else if (error instanceof ApiError) {
        setGeneralError(getApiErrorMessage(error) ?? error.message);
      } else {
        setGeneralError(error instanceof Error ? error.message : "Request failed");
      }
      setTwoFactorCode("");
    } finally {
      setIsSubmitting(false);
    }
  };

  const inTwoFactor = challengeToken !== null;
  const inPicker = inTwoFactor && method === null;
  const isEmail = method === "email";
  const isLocked = lockoutSeconds > 0;
  const trimmedCode = twoFactorCode.trim();
  const canSubmitCode =
    !isSubmitting &&
    !isLocked &&
    trimmedCode.length >= MIN_CODE_LENGTH &&
    trimmedCode.length <= MAX_CODE_LENGTH;

  const cardTitle = inTwoFactor ? "Two-factor authentication" : title;
  const cardDescription = !inTwoFactor
    ? description
    : inPicker
      ? "Choose how to receive your second-factor code."
      : isEmail
        ? "Confirm your sign-in with a code sent to your email."
        : "Enter the 6-digit code from your authenticator app (or a recovery code).";

  return (
    <Card className="w-full max-w-md border-border/80 bg-card/80 shadow-sm backdrop-blur">
      <CardHeader>
        <CardTitle>{cardTitle}</CardTitle>
        <CardDescription>{cardDescription}</CardDescription>
      </CardHeader>
      <CardContent>
        {inPicker ? (
          <div className="space-y-3">
            {factors.includes("totp") ? (
              <Button
                type="button"
                variant="outline"
                className="w-full justify-start"
                onClick={() => {
                  setMethod("totp");
                  setGeneralError("");
                }}
              >
                Authenticator code
              </Button>
            ) : null}
            {factors.includes("email") ? (
              <Button
                type="button"
                variant="outline"
                className="w-full justify-start"
                onClick={() => {
                  setMethod("email");
                  setGeneralError("");
                }}
              >
                Email me a code
              </Button>
            ) : null}
            <button
              type="button"
              className="w-full text-center text-sm text-muted-foreground underline underline-offset-2"
              onClick={resetTwoFactor}
            >
              Back to sign in
            </button>
          </div>
        ) : inTwoFactor ? (
          <form className="space-y-4" onSubmit={onSubmitTwoFactor}>
            {isEmail && !emailCodeSent ? (
              <Button
                type="button"
                className="w-full"
                onClick={() => void sendEmailCode()}
                disabled={isSendingEmailCode || isLocked}
              >
                {isSendingEmailCode ? "Sending..." : "Send code to my email"}
              </Button>
            ) : (
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="auth-2fa-code">
                  {isEmail ? "Email code" : "Authentication code"}
                </label>
                <input
                  id="auth-2fa-code"
                  autoFocus
                  // `text`, not `numeric`: recovery/email codes contain letters. — review I1.
                  inputMode="text"
                  autoComplete="one-time-code"
                  placeholder={isEmail ? "Email code" : "6-digit code or recovery code"}
                  className={AUTH_INPUT_CLASS}
                  value={twoFactorCode}
                  maxLength={MAX_CODE_LENGTH}
                  disabled={isSubmitting || isLocked}
                  onChange={(event) => setTwoFactorCode(event.target.value)}
                  required
                />
                {isEmail ? (
                  <button
                    type="button"
                    className="text-sm text-muted-foreground underline underline-offset-2 disabled:opacity-50"
                    onClick={() => void sendEmailCode()}
                    disabled={isSendingEmailCode || isLocked}
                  >
                    Resend code
                  </button>
                ) : null}
              </div>
            )}

            {generalError ? (
              <p className="rounded-md border border-destructive/35 bg-destructive/12 px-3 py-2 text-sm text-destructive">
                {generalError}
              </p>
            ) : null}
            {isLocked ? (
              <p className="text-sm text-muted-foreground">
                You can retry in {lockoutSeconds}s.
              </p>
            ) : null}

            {!(isEmail && !emailCodeSent) ? (
              <Button type="submit" className="w-full" disabled={!canSubmitCode}>
                {isSubmitting ? "Please wait..." : "Verify"}
              </Button>
            ) : null}
            <button
              type="button"
              className="w-full text-center text-sm text-muted-foreground underline underline-offset-2"
              onClick={() => {
                if (factors.length > 1) {
                  // Back to the factor picker.
                  setMethod(null);
                  setTwoFactorCode("");
                  setEmailCodeSent(false);
                  setGeneralError("");
                } else {
                  resetTwoFactor();
                  setGeneralError("");
                }
              }}
            >
              {factors.length > 1 ? "Choose another method" : "Back to sign in"}
            </button>
          </form>
        ) : (
          <>
            <form className="space-y-4" onSubmit={onSubmit}>
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="auth-email">
                  Email
                </label>
                <input
                  id="auth-email"
                  type="email"
                  autoComplete="email"
                  className={AUTH_INPUT_CLASS}
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
                {emailError ? <p className="text-sm text-destructive">{emailError}</p> : null}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="auth-password">
                  Password
                </label>
                <input
                  id="auth-password"
                  type="password"
                  autoComplete={isSignUp ? "new-password" : "current-password"}
                  className={AUTH_INPUT_CLASS}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  minLength={8}
                  maxLength={128}
                  required
                />
              </div>

              {generalError ? (
                <p className="rounded-md border border-destructive/35 bg-destructive/12 px-3 py-2 text-sm text-destructive">
                  {generalError}
                </p>
              ) : null}

              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? "Please wait..." : submitText}
              </Button>
            </form>

            <div className="mt-4 text-center text-sm text-muted-foreground">
              <Link className="underline underline-offset-2" href={secondaryHref}>
                {secondaryText}
              </Link>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
