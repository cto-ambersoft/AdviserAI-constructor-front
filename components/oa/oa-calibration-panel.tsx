"use client";

import { useEffect, useState } from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getProfileOaCalibration } from "@/lib/api/services/analysis";
import type { OaCalibrationResponse } from "@/lib/api/types";

import { OaSignalBadge } from "./oa-signal-badge";
import { ReliabilityDiagram } from "./reliability-diagram";

type Props = {
  /** Saved profile id; null when the profile is new/unsaved (panel hidden). */
  profileId: number | null;
  /** Whether OA is enabled on this profile. */
  enabled: boolean;
};

function fmt(value: number | null | undefined, digits = 3): string {
  return typeof value === "number" && Number.isFinite(value)
    ? value.toFixed(digits)
    : "—";
}

function pct(value: number | null | undefined): string {
  return typeof value === "number" && Number.isFinite(value)
    ? `${Math.round(value * 100)}%`
    : "—";
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-0.5">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="text-sm font-medium tabular-nums">{value}</p>
    </div>
  );
}

/**
 * Per-profile Outcome-Aware calibration + accuracy panel (S9). Fetches
 * GET /profiles/{id}/oa-calibration and shows either the "collecting data"
 * NEUTRAL state or the calibrator's out-of-sample quality + a reliability diagram.
 */
export function OaCalibrationPanel({ profileId, enabled }: Props) {
  const [data, setData] = useState<OaCalibrationResponse | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // When disabled/unsaved the component renders null, so no reset needed there.
    if (!profileId || !enabled) return;
    let cancelled = false;
    // Reset stale state before fetching: clear the previous profile's data (so it
    // can't flash under the new profile's header on an A→B switch) and show loading.
    /* eslint-disable react-hooks/set-state-in-effect */
    setData(null);
    setLoading(true);
    /* eslint-enable react-hooks/set-state-in-effect */
    getProfileOaCalibration(profileId)
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch(() => {
        if (!cancelled) setData(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [profileId, enabled]);

  if (!enabled || !profileId) return null;

  const calibration = data?.calibration ?? null;
  const accuracy = data?.accuracy ?? [];
  const isActive =
    calibration != null &&
    calibration.status === "active" &&
    calibration.method !== "none";

  return (
    <Card className="bg-background/40" data-testid="oa-calibration-panel">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-sm">Outcome-Aware calibration</CardTitle>
          <OaSignalBadge calibration={calibration} accuracy={accuracy} />
        </div>
        <CardDescription className="text-xs">
          How well this profile&apos;s forecast confidence matches reality, scored
          out-of-sample on past predictions vs real outcomes.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading calibration…</p>
        ) : !isActive ? (
          <p className="text-sm text-muted-foreground">
            Collecting data: {calibration?.sampleSize ?? 0} closed outcome
            {(calibration?.sampleSize ?? 0) === 1 ? "" : "s"} so far. OA stays
            neutral (no influence) until it has enough history to calibrate.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Stat label="Method" value={calibration!.method} />
              <Stat
                label="Samples"
                value={`${calibration!.sampleSize} (${calibration!.trainSize}/${calibration!.holdoutSize})`}
              />
              <Stat label="ECE" value={fmt(calibration!.ece)} />
              <Stat
                label="Brier (cal/raw)"
                value={`${fmt(calibration!.holdoutBrier)} / ${fmt(calibration!.holdoutBrierRaw)}`}
              />
              <Stat
                label="LogLoss (cal/raw)"
                value={`${fmt(calibration!.holdoutLogLoss)} / ${fmt(calibration!.holdoutLogLossRaw)}`}
              />
              {accuracy.map((a) => (
                <Stat
                  key={a.windowDays}
                  label={`Hit / edge (${a.windowDays}d)`}
                  value={`${pct(a.hitRate)} / ${fmt(a.meanEdge, 2)}`}
                />
              ))}
            </div>
            {calibration!.reliabilityBins?.length ? (
              <div className="text-foreground/80">
                <ReliabilityDiagram bins={calibration!.reliabilityBins} />
              </div>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}
