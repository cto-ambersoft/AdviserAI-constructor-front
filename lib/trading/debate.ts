import type { JsonRecord } from "@/lib/api/types";

/** View-model for the optional decision-debate summary shown on a forecast. */
export type DebateSummaryView = {
  topology: string;
  winner: string;
  rounds: number;
  riskRounds: number | null;
  terminationReason: string;
  confidenceDelta: number;
  actionChanged: boolean;
};

function num(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function str(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

/**
 * Extract the debate summary from a forecast's `analysisStructured`, or null
 * when debate did not run / did not apply. Tolerant of missing optional fields.
 */
export function summarizeDebate(
  analysisStructured: JsonRecord | null | undefined,
): DebateSummaryView | null {
  const debate = analysisStructured?.["debate"];
  if (!debate || typeof debate !== "object") {
    return null;
  }
  const d = debate as JsonRecord;
  if (d.applied !== true) {
    return null;
  }
  return {
    topology: str(d.topology),
    winner: str(d.winner),
    rounds: num(d.rounds),
    riskRounds: typeof d.riskRounds === "number" ? d.riskRounds : null,
    terminationReason: str(d.terminationReason),
    confidenceDelta: num(d.confidenceDelta),
    actionChanged: d.actionChanged === true,
  };
}
