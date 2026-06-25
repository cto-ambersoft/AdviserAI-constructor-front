import type { ReactNode } from "react";
import { AppHeader } from "@/components/layout/app-header";
import { StepUpProvider } from "@/components/auth/step-up-provider";
import { RiskEventsProvider } from "@/components/risk-events/risk-events-provider";

export default function ProtectedLayout({ children }: { children: ReactNode }) {
  return (
    <StepUpProvider>
      <RiskEventsProvider />
      <div className="min-h-screen bg-background">
        <AppHeader />
        {children}
      </div>
    </StepUpProvider>
  );
}
