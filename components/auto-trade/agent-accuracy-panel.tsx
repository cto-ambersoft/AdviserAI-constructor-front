"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Gauge, RefreshCw } from "lucide-react";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  listAgentAccuracy,
  type AgentAccuracyMetric,
} from "@/lib/api/services/ai-backtests";
import { summarizeAgentAccuracy } from "@/components/auto-trade/agent-accuracy-utils";

/**
 * T17 (W12f): trader-facing per-(config, agent) accuracy (7d / 30d). Read-only.
 *
 * Applying a weight suggestion mutates a SHARED ai-config (no per-user ownership),
 * so it stays an admin action (admin dashboard) rather than being exposed to every
 * trader here (review C2). This panel only surfaces visibility.
 */
function pct(value: number | null): string {
  return value === null ? "—" : `${(value * 100).toFixed(0)}%`;
}

export function AgentAccuracyPanel() {
  const [metrics, setMetrics] = useState<AgentAccuracyMetric[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { metrics: rows } = await listAgentAccuracy();
      setMetrics(rows ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const rows = useMemo(() => summarizeAgentAccuracy(metrics), [metrics]);
  const showConfig = useMemo(
    () => new Set(rows.map((r) => r.aiConfigId)).size > 1,
    [rows],
  );

  return (
    <Card className="border-border/70 bg-card/60">
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Gauge className="h-4 w-4 text-emerald-300" />
            <CardTitle>Agent Accuracy</CardTitle>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void reload()}
            disabled={loading}
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {error ? <p className="text-xs text-red-400">{error}</p> : null}
        {rows.length === 0 && !loading ? (
          <p className="text-xs text-muted-foreground">
            No agent-accuracy data yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  {showConfig ? <th className="py-1 pr-3">Config</th> : null}
                  <th className="py-1 pr-3">Agent</th>
                  <th className="py-1 pr-3">7d hit</th>
                  <th className="py-1 pr-3">30d hit</th>
                  <th className="py-1 pr-3">samples (7d/30d)</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={`${row.aiConfigId ?? ""}:${row.agentKey}`}
                    className="border-t border-border/40"
                  >
                    {showConfig ? (
                      <td className="py-1 pr-3 text-muted-foreground">
                        {row.aiConfigId ?? "—"}
                      </td>
                    ) : null}
                    <td className="py-1 pr-3 font-medium">{row.agentKey}</td>
                    <td className="py-1 pr-3">{pct(row.hitRate7d)}</td>
                    <td className="py-1 pr-3">{pct(row.hitRate30d)}</td>
                    <td className="py-1 pr-3 text-muted-foreground">
                      {row.sampleSize7d}/{row.sampleSize30d}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          Hit-rate of each agent&apos;s signal vs the real trade outcome (synthetic
          fallback where untraded). Weight tuning is an admin action.
        </p>
      </CardContent>
    </Card>
  );
}
