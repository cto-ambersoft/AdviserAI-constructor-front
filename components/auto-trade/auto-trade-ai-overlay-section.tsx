"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { INPUT_CLASS, Label } from "@/components/trading/form-controls";
import { Button } from "@/components/ui/button";
import {
  getAiOverlayConfig,
  updateAiOverlayConfig,
  type AiOverlayConfig,
} from "@/lib/api/services/live-auto-trade";

const SECTION_CARD =
  "rounded-md border border-border/70 bg-card/40 p-3 space-y-3";

type Props = {
  accountId?: number;
};

const DEFAULT_CONFIG: AiOverlayConfig = {
  enabled: false,
  entry_side_lock_enabled: false,
  atr_scaling_enabled: false,
  rsi_scaling_enabled: false,
  stale_max_minutes: 240,
  min_strength: 0.4,
  atr_scale_range: [0.8, 1.2],
  rsi_max_shift: 5,
};

export function AutoTradeAiOverlaySection({ accountId }: Props) {
  const [config, setConfig] = useState<AiOverlayConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getAiOverlayConfig(
        accountId !== undefined ? { account_id: accountId } : {},
      );
      setConfig(response.config);
    } catch (err) {
      // 404 means no auto-trade config exists yet — keep defaults.
      const message = err instanceof Error ? err.message : String(err);
      if (!message.toLowerCase().includes("not found")) {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const response = await updateAiOverlayConfig(
        config,
        accountId !== undefined ? { account_id: accountId } : {},
      );
      setConfig(response.config);
      toast.success("AI overlay config saved.");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      toast.error(`Failed to save: ${message}`);
    } finally {
      setSaving(false);
    }
  }

  function update<K extends keyof AiOverlayConfig>(
    key: K,
    value: AiOverlayConfig[K],
  ) {
    setConfig((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <div className="space-y-3 rounded-lg border border-border/70 bg-card/60 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-violet-300" />
          <div>
            <h3 className="text-sm font-semibold">AI Trend Overlay (Beta)</h3>
            <p className="text-xs text-muted-foreground">
              Adapt live auto-trade parameters from the freshest ai_trend in
              your personal analysis pipeline. Opt-in; defaults are safe.
            </p>
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={config.enabled}
            onChange={(e) => update("enabled", e.target.checked)}
            disabled={loading}
          />
          Enable overlay
        </label>
      </div>

      {error ? (
        <p className="rounded-md border border-destructive/35 bg-destructive/12 px-3 py-2 text-xs text-destructive">
          {error}
        </p>
      ) : null}

      <div className={SECTION_CARD}>
        <p className="text-xs font-medium text-muted-foreground">
          Phases (each independently togglable)
        </p>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={config.entry_side_lock_enabled}
            onChange={(e) =>
              update("entry_side_lock_enabled", e.target.checked)
            }
            disabled={!config.enabled || loading}
          />
          Block opposite-side entries
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={config.atr_scaling_enabled}
            onChange={(e) => update("atr_scaling_enabled", e.target.checked)}
            disabled={!config.enabled || loading}
          />
          Scale ATR multiplier (SL)
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={config.rsi_scaling_enabled}
            onChange={(e) => update("rsi_scaling_enabled", e.target.checked)}
            disabled={!config.enabled || loading}
          />
          Shift RSI watcher thresholds
        </label>
      </div>

      <div className={SECTION_CARD}>
        <p className="text-xs font-medium text-muted-foreground">Tuning</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label text="Min strength (0–1)" />
            <input
              type="number"
              min={0}
              max={1}
              step={0.05}
              value={config.min_strength}
              onChange={(e) =>
                update("min_strength", Number(e.target.value) || 0)
              }
              disabled={!config.enabled || loading}
              className={INPUT_CLASS}
            />
          </div>
          <div>
            <Label text="Max age (minutes)" />
            <input
              type="number"
              min={1}
              max={1440}
              step={15}
              value={config.stale_max_minutes}
              onChange={(e) =>
                update("stale_max_minutes", Number(e.target.value) || 240)
              }
              disabled={!config.enabled || loading}
              className={INPUT_CLASS}
            />
          </div>
          <div>
            <Label text="RSI max shift (points)" />
            <input
              type="number"
              min={0}
              max={20}
              step={1}
              value={config.rsi_max_shift}
              onChange={(e) =>
                update("rsi_max_shift", Number(e.target.value) || 0)
              }
              disabled={!config.enabled || loading}
              className={INPUT_CLASS}
            />
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <Button
          type="button"
          size="sm"
          onClick={() => void save()}
          disabled={loading || saving}
        >
          {saving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : null}
          Save overlay config
        </Button>
      </div>
    </div>
  );
}
