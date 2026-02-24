"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ApiError } from "@/lib/api";
import { getApiErrorMessage, useAuthStore } from "@/stores/auth-store";

type AuthMode = "signin" | "signup";

const AUTH_INPUT_CLASS =
  "h-10 w-full rounded-md border border-input/80 bg-background/70 px-3 text-sm text-foreground shadow-xs outline-none ring-offset-background transition-colors placeholder:text-muted-foreground/90 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/35";

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
  const register = useAuthStore((state) => state.register);
  const status = useAuthStore((state) => state.status);
  const hasHydrated = useAuthStore((state) => state.hasHydrated);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [generalError, setGeneralError] = useState("");
  const [emailError, setEmailError] = useState("");

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

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setGeneralError("");
    setEmailError("");
    setIsSubmitting(true);

    try {
      if (isSignUp) {
        await register({ email: email.trim(), password });
      } else {
        await login({ email: email.trim(), password });
      }

      redirectToNext(nextTarget);
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

  return (
    <Card className="w-full max-w-md border-border/80 bg-card/80 shadow-sm backdrop-blur">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
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
      </CardContent>
    </Card>
  );
}
