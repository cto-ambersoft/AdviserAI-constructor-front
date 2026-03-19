"use client";

import { AlertTriangle } from "lucide-react";

type Props = {
  warnings: string[];
};

export function AutoTradeSyncWarning({ warnings }: Props) {
  if (warnings.length === 0) {
    return null;
  }

  return (
    <div className="rounded-lg border border-amber-400/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
      <p className="mb-2 inline-flex items-center gap-2 font-medium">
        <AlertTriangle className="h-4 w-4" />
        Sync warnings
      </p>
      <ul className="space-y-1">
        {warnings.map((warning, index) => (
          <li key={`${warning}-${index}`}>- {warning}</li>
        ))}
      </ul>
    </div>
  );
}
