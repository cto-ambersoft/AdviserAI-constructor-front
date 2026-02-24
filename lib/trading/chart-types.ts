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
