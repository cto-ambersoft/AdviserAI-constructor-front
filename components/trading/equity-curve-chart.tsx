"use client";

import { useEffect, useRef } from "react";
import { ColorType, LineSeries, LineStyle, createChart, type IChartApi } from "lightweight-charts";
import type { UTCTimestamp } from "lightweight-charts";

type EquityCurvePoint = {
  time: UTCTimestamp;
  value: number;
};

type EquityCurveChartProps = {
  points: EquityCurvePoint[];
  height?: number;
};

const CHART_COLORS = {
  text: "hsl(220 14% 84%)",
  grid: "hsl(230 20% 30% / 35%)",
  border: "hsl(230 15% 38% / 55%)",
  line: "hsl(165 78% 45%)",
} as const;

function normalizeChartPoints(points: EquityCurvePoint[]): EquityCurvePoint[] {
  if (points.length <= 1) {
    return points;
  }

  const sorted = [...points].sort((a, b) => Number(a.time) - Number(b.time));
  const deduped: EquityCurvePoint[] = [];

  for (const point of sorted) {
    const prev = deduped[deduped.length - 1];
    if (prev && prev.time === point.time) {
      // Lightweight Charts requires strictly ascending timestamps.
      // Keep the latest value for duplicate timestamps.
      deduped[deduped.length - 1] = point;
      continue;
    }
    deduped.push(point);
  }

  return deduped;
}

export function EquityCurveChart({ points, height = 240 }: EquityCurveChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ReturnType<IChartApi["addSeries"]> | null>(null);
  const heightRef = useRef(height);

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    const container = containerRef.current;
    const chart = createChart(container, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: CHART_COLORS.text,
        attributionLogo: false,
      },
      grid: {
        vertLines: { visible: true, color: CHART_COLORS.grid, style: LineStyle.Dotted },
        horzLines: { visible: true, color: CHART_COLORS.grid, style: LineStyle.Dotted },
      },
      rightPriceScale: {
        borderVisible: true,
        borderColor: CHART_COLORS.border,
        scaleMargins: { top: 0.12, bottom: 0.1 },
      },
      leftPriceScale: { visible: false },
      timeScale: {
        borderVisible: true,
        borderColor: CHART_COLORS.border,
        timeVisible: true,
        secondsVisible: false,
      },
      localization: {
        priceFormatter: (value: number) =>
          value.toLocaleString(undefined, { maximumFractionDigits: 2 }),
      },
      width: container.clientWidth,
      height: heightRef.current,
    });

    const equitySeries = chart.addSeries(LineSeries, {
      color: CHART_COLORS.line,
      lineWidth: 2,
      priceLineVisible: true,
      lastValueVisible: true,
    });
    equitySeries.setData([]);
    chart.timeScale().fitContent();

    const resizeObserver = new ResizeObserver(() => {
      chart.resize(container.clientWidth, heightRef.current);
    });
    resizeObserver.observe(container);

    chartRef.current = chart;
    seriesRef.current = equitySeries;
    return () => {
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  useEffect(() => {
    heightRef.current = height;
    if (!containerRef.current || !chartRef.current) {
      return;
    }
    chartRef.current.resize(containerRef.current.clientWidth, height);
  }, [height]);

  useEffect(() => {
    if (!chartRef.current || !seriesRef.current) {
      return;
    }
    seriesRef.current.setData(normalizeChartPoints(points));
    chartRef.current.timeScale().fitContent();
  }, [points]);

  return (
    <div className="relative w-full" style={{ height }}>
      <div ref={containerRef} className="h-full w-full" />
      {points.length === 0 ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-lg border border-dashed border-border/70 bg-muted/15 p-4 text-sm text-muted-foreground">
          No equity curve points for this run.
        </div>
      ) : null}
    </div>
  );
}
