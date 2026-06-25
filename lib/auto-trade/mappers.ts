import type { SeriesMarker, Time, UTCTimestamp } from "lightweight-charts";
import type {
  AccountAutoTradeEventRead,
  AccountTradeRead,
  AutoTradeEventRead,
} from "@/lib/api";

export type AutoTradeTimelineRow = {
  id: string;
  created_at: string;
  level: string;
  event_type: string;
  message: string;
  source: "account_trades" | "runtime";
};

function toUnixTimestamp(value: string): UTCTimestamp | null {
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    return null;
  }
  return Math.floor(parsed / 1000) as UTCTimestamp;
}

export function normalizeSymbolForChart(
  symbol: string | null | undefined,
): string {
  if (!symbol) {
    return "";
  }
  const trimmed = symbol.trim();
  if (!trimmed) {
    return "";
  }
  const [normalized] = trimmed.split(":");
  return normalized ?? trimmed;
}

export function normalizeSymbolForMarketQuery(
  symbol: string | null | undefined,
): string {
  const chartSymbol = normalizeSymbolForChart(symbol).toUpperCase();
  if (!chartSymbol) {
    return "";
  }

  if (chartSymbol.includes("/")) {
    return chartSymbol;
  }

  const compact = chartSymbol.replaceAll("-", "").replaceAll("_", "");
  const knownQuotes = ["USDT", "USDC", "USD", "BTC", "ETH"] as const;
  for (const quote of knownQuotes) {
    if (compact.endsWith(quote) && compact.length > quote.length) {
      const base = compact.slice(0, -quote.length);
      return `${base}/${quote}`;
    }
  }

  return `${compact}/USDT`;
}

export function mapAccountTradesToChartMarkers(
  trades: AccountTradeRead[],
): SeriesMarker<Time>[] {
  return trades
    .map((trade, index) => {
      const timestamp = toUnixTimestamp(trade.timestamp);
      if (timestamp === null) {
        return null;
      }
      // One sub-account per strategy: every fill is the strategy's, so the
      // marker is just BUY/SELL — no auto/manual distinction.
      const isBuy = trade.side.trim().toLowerCase() === "buy";
      const price = Number.isFinite(trade.price) ? trade.price.toFixed(2) : "-";
      return {
        id: `${trade.exchange_trade_id}-${timestamp}-${index}`,
        time: timestamp,
        position: isBuy ? ("belowBar" as const) : ("aboveBar" as const),
        shape: isBuy ? ("arrowUp" as const) : ("arrowDown" as const),
        color: isBuy ? "hsl(161 84% 42%)" : "hsl(350 90% 61%)",
        text: `${isBuy ? "BUY" : "SELL"} @ ${price}`,
        size: 1.3,
      };
    })
    .filter((marker): marker is NonNullable<typeof marker> => marker !== null)
    .sort((a, b) => Number(a.time) - Number(b.time));
}

export function mapAutoTradeEventsToTimelineRows(
  accountEvents: AccountAutoTradeEventRead[],
  runtimeEvents: AutoTradeEventRead[],
): AutoTradeTimelineRow[] {
  const rows: AutoTradeTimelineRow[] = [];

  for (const event of accountEvents) {
    rows.push({
      id: `account-${event.id}`,
      created_at: event.created_at,
      level: event.level,
      event_type: event.event_type,
      message: event.message ?? "-",
      source: "account_trades",
    });
  }

  for (const event of runtimeEvents) {
    rows.push({
      id: `runtime-${event.id}`,
      created_at: event.created_at,
      level: event.level,
      event_type: event.event_type,
      message: event.message ?? "-",
      source: "runtime",
    });
  }

  return rows.sort(
    (a, b) => Date.parse(b.created_at || "") - Date.parse(a.created_at || ""),
  );
}
