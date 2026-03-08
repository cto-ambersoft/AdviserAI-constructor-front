import type { ReactNode } from "react";
import { AppHeader } from "@/components/layout/app-header";
import { AppStatusFooter } from "@/components/layout/app-status-footer";

export default function ProtectedLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background pb-8">
      <AppHeader />
      {children}
      <AppStatusFooter />
    </div>
  );
}
