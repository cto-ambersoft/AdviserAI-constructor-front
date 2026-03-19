"use client";

import { useEffect, useRef } from "react";
import {
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  LineSeries,
  LineStyle,
  createSeriesMarkers,
  createChart,
  type ISeriesApi,
  type ISeriesMarkersPluginApi,
  type SeriesMarker,
  type Time,
  type IChartApi,
} from "lightweight-charts";
import type { CandlePoint, OverlayLine } from "@/lib/trading/chart-types";

type MarketChartProps = {
  candles: CandlePoint[];
  overlays?: OverlayLine[];
  markers?: SeriesMarker<Time>[];
  height?: number;
};

const CHART_COLORS = {
  text: "hsl(220 14% 84%)",
  grid: "hsl(230 20% 30% / 35%)",
  crosshair: "hsl(221 18% 68% / 50%)",
  crosshairLabel: "hsl(227 22% 24%)",
  border: "hsl(230 15% 38% / 55%)",
  candleUp: "hsl(161 84% 42%)",
  candleDown: "hsl(350 90% 61%)",
  priceLine: "hsl(218 82% 68%)",
} as const;

function toLineStyle(style?: "solid" | "dashed" | "dotted") {
  if (style === "dotted") {
    return LineStyle.Dotted;
  }
  if (style === "dashed") {
    return LineStyle.Dashed;
  }
  return LineStyle.Solid;
}

function toLineWidth(width?: number): 1 | 2 | 3 | 4 {
  if (width && width <= 1) {
    return 1;
  }
  if (width === 3) {
    return 3;
  }
  if (width && width >= 4) {
    return 4;
  }
  return 2;
}

function formatPrice(value: number) {
  return value.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

function formatLegendTime(time: Time | undefined) {
  if (typeof time === "number") {
    return new Date(time * 1000).toLocaleString();
  }
  if (typeof time === "string") {
    return new Date(time).toLocaleString();
  }
  if (
    time &&
    typeof time === "object" &&
    "year" in time &&
    "month" in time &&
    "day" in time
  ) {
    return `${time.year}-${String(time.month).padStart(2, "0")}-${String(time.day).padStart(2, "0")}`;
  }
  return "";
}

export function MarketChart({
  candles,
  overlays = [],
  markers = [],
  height = 420,
}: MarketChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const overlaySeriesRef = useRef(new Map<string, ISeriesApi<"Line">>());
  const markerPluginRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null);
  const legendPrimaryRef = useRef<HTMLParagraphElement | null>(null);
  const legendSecondaryRef = useRef<HTMLParagraphElement | null>(null);
  const candlesRef = useRef<CandlePoint[]>([]);
  const heightRef = useRef(height);

  const updateLegend = (
    source: { open: number; high: number; low: number; close: number },
    time?: Time,
  ) => {
    const primary = legendPrimaryRef.current;
    const secondary = legendSecondaryRef.current;
    if (!primary || !secondary) {
      return;
    }

    const delta = source.close - source.open;
    const deltaText = `${delta >= 0 ? "+" : ""}${formatPrice(delta)}`;
    const deltaColor = delta >= 0 ? "hsl(161 84% 52%)" : "hsl(350 90% 64%)";
    primary.innerHTML = `O <span>${formatPrice(source.open)}</span> H <span>${formatPrice(source.high)}</span> L <span>${formatPrice(source.low)}</span> C <span>${formatPrice(source.close)}</span> <span style="color:${deltaColor}">${deltaText}</span>`;
    secondary.textContent = time ? formatLegendTime(time) : "";
  };

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    const container = containerRef.current;
    const overlaySeries = overlaySeriesRef.current;
    const chart = createChart(container, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: CHART_COLORS.text,
        attributionLogo: false,
      },
      grid: {
        vertLines: {
          visible: true,
          color: CHART_COLORS.grid,
          style: LineStyle.Dotted,
        },
        horzLines: {
          visible: true,
          color: CHART_COLORS.grid,
          style: LineStyle.Dotted,
        },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: CHART_COLORS.crosshair,
          style: LineStyle.Dashed,
          width: 1,
          labelBackgroundColor: CHART_COLORS.crosshairLabel,
        },
        horzLine: {
          color: CHART_COLORS.crosshair,
          style: LineStyle.Dashed,
          width: 1,
          labelBackgroundColor: CHART_COLORS.crosshairLabel,
        },
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: false,
      },
      handleScale: {
        axisPressedMouseMove: true,
        mouseWheel: true,
        pinch: true,
      },
      rightPriceScale: {
        borderVisible: true,
        borderColor: CHART_COLORS.border,
        scaleMargins: {
          top: 0.12,
          bottom: 0.12,
        },
      },
      leftPriceScale: { visible: false },
      timeScale: {
        borderVisible: true,
        borderColor: CHART_COLORS.border,
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 6,
        barSpacing: 10,
        minBarSpacing: 4,
      },
      localization: {
        priceFormatter: (price: number) => formatPrice(price),
      },
      width: container.clientWidth,
      height: heightRef.current,
    });

    chartRef.current = chart;
    const series = chart.addSeries(CandlestickSeries, {
      upColor: CHART_COLORS.candleUp,
      downColor: CHART_COLORS.candleDown,
      wickUpColor: CHART_COLORS.candleUp,
      wickDownColor: CHART_COLORS.candleDown,
      borderVisible: false,
    });
    candleSeriesRef.current = series;

    series.applyOptions({
      priceLineVisible: true,
      lastValueVisible: true,
      priceLineColor: CHART_COLORS.priceLine,
    });
    markerPluginRef.current = createSeriesMarkers(series, []);

    const handleCrosshairMove = (
      param: Parameters<IChartApi["subscribeCrosshairMove"]>[0] extends (
        arg: infer P,
      ) => void
        ? P
        : never,
    ) => {
      const candleSeries = candleSeriesRef.current;
      if (!candleSeries) {
        return;
      }
      const hovered = param.seriesData.get(candleSeries);
      if (
        hovered &&
        typeof hovered === "object" &&
        "open" in hovered &&
        "high" in hovered &&
        "low" in hovered &&
        "close" in hovered &&
        typeof hovered.open === "number" &&
        typeof hovered.high === "number" &&
        typeof hovered.low === "number" &&
        typeof hovered.close === "number"
      ) {
        updateLegend(
          {
            open: hovered.open,
            high: hovered.high,
            low: hovered.low,
            close: hovered.close,
          },
          param.time,
        );
        return;
      }

      const latestCandle = candlesRef.current[candlesRef.current.length - 1];
      if (latestCandle) {
        updateLegend(latestCandle, latestCandle.time);
      }
    };

    chart.subscribeCrosshairMove(handleCrosshairMove);

    const observer = new ResizeObserver(() => {
      chart.resize(container.clientWidth, heightRef.current);
    });

    observer.observe(container);

    return () => {
      chart.unsubscribeCrosshairMove(handleCrosshairMove);
      observer.disconnect();
      overlaySeries.clear();
      markerPluginRef.current = null;
      candleSeriesRef.current = null;
      chart.remove();
      chartRef.current = null;
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
    if (!chartRef.current || !candleSeriesRef.current) {
      return;
    }

    candlesRef.current = candles;
    candleSeriesRef.current.setData(candles);
    if (markerPluginRef.current) {
      markerPluginRef.current.setMarkers(markers);
    }
    if (candles.length > 0) {
      const latest = candles[candles.length - 1];
      updateLegend(latest, latest.time);
      chartRef.current.timeScale().fitContent();
    }
  }, [candles, markers]);

  useEffect(() => {
    if (!chartRef.current) {
      return;
    }

    const existing = overlaySeriesRef.current;
    const nextIds = new Set(overlays.map((overlay) => overlay.id));

    for (const [seriesId, series] of existing.entries()) {
      if (!nextIds.has(seriesId)) {
        chartRef.current.removeSeries(series);
        existing.delete(seriesId);
      }
    }

    for (const overlay of overlays) {
      const existingSeries = existing.get(overlay.id);
      if (existingSeries) {
        existingSeries.setData(overlay.data);
        continue;
      }

      const nextSeries = chartRef.current.addSeries(LineSeries, {
        color: overlay.color ?? "hsl(215 82% 68%)",
        lineWidth: toLineWidth(overlay.width),
        lineStyle: toLineStyle(overlay.style),
        priceLineVisible: false,
        lastValueVisible: false,
      });
      nextSeries.setData(overlay.data);
      existing.set(overlay.id, nextSeries);
    }
  }, [overlays]);

  return (
    <div className="relative w-full" style={{ height }}>
      <div ref={containerRef} className="h-full w-full" />
      <div className="pointer-events-none absolute left-2 top-2 z-10 rounded-md border border-border/70 bg-background/75 px-2 py-1.5 text-xs backdrop-blur">
        <p ref={legendPrimaryRef} className="font-medium text-foreground" />
        <p
          ref={legendSecondaryRef}
          className="text-[11px] text-muted-foreground"
        />
      </div>
    </div>
  );
}
