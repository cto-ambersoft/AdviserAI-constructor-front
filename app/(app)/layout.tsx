import type { ReactNode } from "react";
import { AppHeader } from "@/components/layout/app-header";

export default function ProtectedLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      {children}
    </div>
  );
}
