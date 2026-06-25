import type { UTCTimestamp } from "lightweight-charts";

export type CandlePoint = {
  time: UTCTimestamp;
  open: number;
  high: number;
  low: number;
  close: number;
};

export type OverlayLine = {
  id: string;
  color?: string;
  style?: "solid" | "dashed" | "dotted";
  width?: number;
  data: Array<{ time: UTCTimestamp; value: number }>;
};

// A horizontal price line drawn across the chart (e.g. open-position TP / SL).
export type PriceLineInput = {
  id: string;
  price: number;
  color?: string;
  title?: string;
  style?: "solid" | "dashed" | "dotted";
};
