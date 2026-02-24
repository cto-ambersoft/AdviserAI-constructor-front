import { Suspense } from "react";
import { AuthFormCard } from "@/components/auth/auth-form-card";

export default function SignupPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Suspense fallback={<div className="text-sm text-muted-foreground">Loading sign up...</div>}>
        <AuthFormCard mode="signup" />
      </Suspense>
    </main>
  );
}
