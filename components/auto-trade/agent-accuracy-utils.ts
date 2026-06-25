import type { AgentAccuracyMetric } from "@/lib/api/services/ai-backtests";

/** Per-(config, agent) accuracy rolled up across the 7d / 30d windows. */
export type AgentAccuracyRow = {
  aiConfigId: string | null;
  agentKey: string;
  hitRate7d: number | null;
  hitRate30d: number | null;
  sampleSize7d: number;
  sampleSize30d: number;
};

/**
 * T17 (W12f): collapse the per-(agent, window) accuracy metrics into one row per
 * (aiConfigId, agent) with its 7d and 30d hit-rate + sample size.
 *
 * Keyed by config AND agent (review I7): collapsing across configs would show a
 * hit-rate from one config next to a sample size from another, which a trader could
 * act on. Each row is unambiguous; sorted by config then agent.
 */
export function summarizeAgentAccuracy(
  metrics: AgentAccuracyMetric[],
): AgentAccuracyRow[] {
  const byKey = new Map<string, AgentAccuracyRow>();
  for (const m of metrics) {
    const configId = m.aiConfigId ?? null;
    const key = `${configId ?? ""}::${m.agentKey}`;
    const row =
      byKey.get(key) ??
      {
        aiConfigId: configId,
        agentKey: m.agentKey,
        hitRate7d: null,
        hitRate30d: null,
        sampleSize7d: 0,
        sampleSize30d: 0,
      };
    if (m.windowDays === 7) {
      row.hitRate7d = m.hitRate;
      row.sampleSize7d = m.sampleSize;
    } else if (m.windowDays === 30) {
      row.hitRate30d = m.hitRate;
      row.sampleSize30d = m.sampleSize;
    }
    byKey.set(key, row);
  }
  return [...byKey.values()].sort(
    (a, b) =>
      (a.aiConfigId ?? "").localeCompare(b.aiConfigId ?? "") ||
      a.agentKey.localeCompare(b.agentKey),
  );
}
