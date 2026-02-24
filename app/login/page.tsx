import { Suspense } from "react";
import { AuthFormCard } from "@/components/auth/auth-form-card";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Suspense fallback={<div className="text-sm text-muted-foreground">Loading login...</div>}>
        <AuthFormCard mode="signin" />
      </Suspense>
    </main>
  );
}
