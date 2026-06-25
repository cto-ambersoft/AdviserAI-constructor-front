import { Check } from "lucide-react";

import { cn } from "@/lib/utils";
import type { WIZARD_STEPS } from "./state";

type Step = (typeof WIZARD_STEPS)[number];

/** Horizontal progress stepper for the launch wizard (UX overhaul T7). */
export function WizardStepper({
  steps,
  current,
}: {
  steps: readonly Step[];
  current: number;
}) {
  return (
    <ol className="mb-4 flex w-full items-center gap-1.5">
      {steps.map((step, index) => {
        const done = index < current;
        const active = index === current;
        return (
          <li key={step.id} className="flex flex-1 items-center gap-1.5">
            <span
              className={cn(
                "flex size-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold",
                done && "border-primary bg-primary text-primary-foreground",
                active && "border-primary text-primary",
                !done && !active && "border-border text-muted-foreground",
              )}
            >
              {done ? <Check className="size-3.5" /> : index + 1}
            </span>
            <span
              className={cn(
                "hidden truncate text-xs sm:inline",
                active ? "font-medium text-foreground" : "text-muted-foreground",
              )}
            >
              {step.title}
            </span>
            {index < steps.length - 1 ? (
              <span
                className={cn(
                  "h-px flex-1",
                  done ? "bg-primary" : "bg-border",
                )}
              />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
