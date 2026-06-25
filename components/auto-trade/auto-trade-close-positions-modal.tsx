"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { INPUT_CLASS } from "@/components/trading/form-controls";
import { ApiError, closeAutoTradePositions } from "@/lib/api";
import type {
  AutoTradeClosePreview,
  AutoTradeClosePreviewItem,
  AutoTradeCloseOpenPositionsResponse,
} from "@/lib/api/types";
import { notifyError, notifySuccess, notifyWarning } from "@/lib/notifications";
import { cn } from "@/lib/utils";

const REQUIRED_PHRASE = "CONFIRM";

type Phase = "loading-preview" | "preview" | "executing" | "done";

type Props = {
  /** Currently selected account scope. Required to scope the close. */
  accountId: number;
  /** Optional human label for the account, shown in the modal header. */
  accountLabel?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called once the close completed (or partially failed). The dashboard
   *  uses this to refresh the runtime state, events, and trades panels. */
  onClosed?: (result: AutoTradeCloseOpenPositionsResponse) => void;
};

export function AutoTradeClosePositionsModal({
  accountId,
  accountLabel,
  open,
  onOpenChange,
  onClosed,
}: Props) {
  const [phase, setPhase] = useState<Phase>("loading-preview");
  const [preview, setPreview] = useState<AutoTradeClosePreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [confirmInput, setConfirmInput] = useState("");
  const [executionError, setExecutionError] = useState<string | null>(null);
  const [result, setResult] = useState<
    AutoTradeCloseOpenPositionsResponse | null
  >(null);

  // ── load preview when modal opens ──────────────────────────────────────
  // The dashboard mounts this component only while ``open`` is true, so we
  // do not have to reset state when ``open`` flips back to false — the
  // component itself is unmounted and the next open mounts a fresh one.
  useEffect(() => {
    if (!open) {
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        // The endpoint with confirm:false returns 412 with the preview body
        // — we treat that as the success path of the preview phase.
        await closeAutoTradePositions({
          account_id: accountId,
          confirm: false,
        });
        // If we ever get here it means the backend returned 200 without a
        // confirm — surface that as a hard error since it should be impossible.
        if (cancelled) {
          return;
        }
        setPreviewError(
          "Backend did not require confirmation — refusing to proceed.",
        );
        setPhase("preview");
      } catch (error) {
        if (cancelled) {
          return;
        }
        if (error instanceof ApiError && error.status === 412) {
          const body = error.data as AutoTradeClosePreview;
          setPreview(body);
          setPhase("preview");
          return;
        }
        setPreviewError(toUserError(error, "Failed to load close preview."));
        setPhase("preview");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [accountId, open]);

  const phraseValid = confirmInput.trim().toUpperCase() === REQUIRED_PHRASE;
  const hasPositions = (preview?.total_count ?? 0) > 0;
  const canExecute =
    phase === "preview" && phraseValid && hasPositions && previewError === null;

  const handleConfirm = useCallback(async () => {
    if (!canExecute) {
      return;
    }
    setPhase("executing");
    setExecutionError(null);
    try {
      const response = await closeAutoTradePositions({
        account_id: accountId,
        confirm: true,
        reason: reason.trim() || undefined,
      });
      setResult(response);
      setPhase("done");
      const closed = response.closed.length;
      const failed = response.failed.length;
      const skipped = response.skipped_already_closed.length;
      if (failed > 0) {
        notifyWarning(
          `Closed ${closed}, failed ${failed}, skipped ${skipped}. See details below.`,
        );
      } else {
        notifySuccess(
          `Closed ${closed} position${closed === 1 ? "" : "s"}` +
            (skipped > 0 ? ` (${skipped} already flat).` : "."),
        );
      }
      onClosed?.(response);
    } catch (error) {
      setExecutionError(toUserError(error, "Close failed."));
      setPhase("preview");
      notifyError(toUserError(error, "Close failed."));
    }
  }, [accountId, canExecute, onClosed, reason]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-400" />
            Close all auto-trade positions
          </DialogTitle>
          <DialogDescription>
            This is a destructive operation. Every open auto-trade position
            for{" "}
            <span className="font-medium text-foreground">
              {accountLabel ?? `account #${accountId}`}
            </span>{" "}
            will be market-closed and all known TP / SL conditional orders
            cancelled. The auto-trade <em>is_running</em> flag is{" "}
            <strong>not</strong> changed — manual flatten and stop are
            independent.
          </DialogDescription>
        </DialogHeader>

        {phase === "loading-preview" ? <LoadingBlock /> : null}

        {phase !== "loading-preview" && previewError ? (
          <ErrorBanner message={previewError} />
        ) : null}

        {phase !== "loading-preview" && !previewError && preview ? (
          <PreviewBlock preview={preview} />
        ) : null}

        {phase === "executing" ? (
          <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Cancelling conditional orders and market-closing positions...
          </p>
        ) : null}

        {phase === "done" && result ? (
          <ResultBlock result={result} />
        ) : null}

        {phase === "preview" && !previewError && hasPositions ? (
          <ConfirmInputs
            confirmInput={confirmInput}
            setConfirmInput={setConfirmInput}
            reason={reason}
            setReason={setReason}
            executionError={executionError}
          />
        ) : null}

        <DialogFooter>
          {phase === "done" ? (
            <DialogClose asChild>
              <Button>Close</Button>
            </DialogClose>
          ) : (
            <>
              <DialogClose asChild>
                <Button variant="outline" disabled={phase === "executing"}>
                  Cancel
                </Button>
              </DialogClose>
              <Button
                variant="destructive"
                onClick={() => void handleConfirm()}
                // ``canExecute`` already encodes phase === "preview"; when
                // we are executing, ``canExecute`` is false (phase narrows
                // out of "preview"), so this single check covers both.
                disabled={!canExecute}
                title={
                  !hasPositions
                    ? "Nothing to close"
                    : !phraseValid
                      ? `Type ${REQUIRED_PHRASE} to enable`
                      : undefined
                }
              >
                {phase === "executing"
                  ? "Closing..."
                  : `Close ${preview?.total_count ?? 0} position${
                      (preview?.total_count ?? 0) === 1 ? "" : "s"
                    }`}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────── sub-blocks ──────────────────────────────────

function LoadingBlock() {
  return (
    <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" />
      Loading preview from server...
    </p>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="rounded-md border border-destructive/35 bg-destructive/10 p-3 text-sm text-destructive">
      {message}
    </div>
  );
}

function PreviewBlock({ preview }: { preview: AutoTradeClosePreview }) {
  // Hook must precede any early return to comply with the rules of hooks.
  const totalConditionals = useMemo(
    () =>
      preview.positions.reduce(
        (acc, item) => acc + item.open_conditional_orders_count,
        0,
      ),
    [preview.positions],
  );

  if (preview.total_count === 0) {
    return (
      <p className="rounded-md border border-border/60 bg-background/40 p-3 text-sm text-muted-foreground">
        No open auto-trade positions for this account. Nothing to close.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Badge variant="outline">positions: {preview.total_count}</Badge>
        <Badge variant="outline">
          conditional orders: {totalConditionals}
        </Badge>
      </div>
      <div className="max-h-[260px] overflow-auto rounded-md border border-border/70">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-muted">
            <tr>
              <th className="px-2 py-2 text-left">#</th>
              <th className="px-2 py-2 text-left">Symbol</th>
              <th className="px-2 py-2 text-left">Side</th>
              <th className="px-2 py-2 text-right">Qty</th>
              <th className="px-2 py-2 text-right">Entry</th>
              <th className="px-2 py-2 text-right">SL</th>
              <th className="px-2 py-2 text-right">TP/SL orders</th>
            </tr>
          </thead>
          <tbody>
            {preview.positions.map((item) => (
              <PreviewRow key={item.position_id} item={item} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PreviewRow({ item }: { item: AutoTradeClosePreviewItem }) {
  const sideTone = item.side === "LONG" ? "text-emerald-300" : "text-rose-300";
  return (
    <tr className="border-t border-border/60">
      <td className="px-2 py-1.5 text-muted-foreground">{item.position_id}</td>
      <td className="px-2 py-1.5 font-mono">{item.symbol}</td>
      <td className={cn("px-2 py-1.5 font-medium", sideTone)}>{item.side}</td>
      <td className="px-2 py-1.5 text-right font-mono">
        {item.current_quantity.toLocaleString(undefined, {
          maximumFractionDigits: 6,
        })}
      </td>
      <td className="px-2 py-1.5 text-right font-mono">
        {formatPrice(item.entry_price)}
      </td>
      <td className="px-2 py-1.5 text-right font-mono">
        {item.current_sl_price !== null ? formatPrice(item.current_sl_price) : "—"}
      </td>
      <td className="px-2 py-1.5 text-right">
        {item.open_conditional_orders_count}
      </td>
    </tr>
  );
}

function ConfirmInputs({
  confirmInput,
  setConfirmInput,
  reason,
  setReason,
  executionError,
}: {
  confirmInput: string;
  setConfirmInput: (next: string) => void;
  reason: string;
  setReason: (next: string) => void;
  executionError: string | null;
}) {
  return (
    <div className="space-y-3 rounded-md border border-amber-400/40 bg-amber-400/5 p-3">
      <div>
        <p className="text-sm">
          Type{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
            {REQUIRED_PHRASE}
          </code>{" "}
          to enable the close button.
        </p>
        <input
          type="text"
          autoFocus
          autoComplete="off"
          spellCheck={false}
          className={cn(INPUT_CLASS, "mt-2")}
          value={confirmInput}
          onChange={(event) => setConfirmInput(event.target.value)}
          placeholder={REQUIRED_PHRASE}
        />
      </div>
      <div>
        <p className="text-xs text-muted-foreground">
          Reason (optional, recorded in audit log).
        </p>
        <input
          type="text"
          maxLength={200}
          className={cn(INPUT_CLASS, "mt-1")}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="e.g. end-of-shift / news event"
        />
      </div>
      {executionError ? (
        <p className="text-sm text-destructive">{executionError}</p>
      ) : null}
    </div>
  );
}

function ResultBlock({
  result,
}: {
  result: AutoTradeCloseOpenPositionsResponse;
}) {
  const closedCount = result.closed.length;
  const failedCount = result.failed.length;
  const skippedCount = result.skipped_already_closed.length;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Badge variant={closedCount > 0 ? "default" : "outline"}>
          closed: {closedCount}
        </Badge>
        <Badge variant={failedCount > 0 ? "destructive" : "outline"}>
          failed: {failedCount}
        </Badge>
        <Badge variant="outline">already flat: {skippedCount}</Badge>
      </div>

      {closedCount > 0 ? (
        <div className="max-h-[180px] overflow-auto rounded-md border border-border/70">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-muted">
              <tr>
                <th className="px-2 py-1.5 text-left">Symbol</th>
                <th className="px-2 py-1.5 text-left">Side</th>
                <th className="px-2 py-1.5 text-right">Executed</th>
                <th className="px-2 py-1.5 text-right">Avg price</th>
                <th className="px-2 py-1.5 text-right">Cancelled</th>
              </tr>
            </thead>
            <tbody>
              {result.closed.map((row) => (
                <tr
                  key={row.position_id}
                  className="border-t border-border/60"
                >
                  <td className="px-2 py-1.5 font-mono">{row.symbol}</td>
                  <td className="px-2 py-1.5">{row.side}</td>
                  <td className="px-2 py-1.5 text-right font-mono">
                    {row.executed_qty.toLocaleString(undefined, {
                      maximumFractionDigits: 6,
                    })}
                  </td>
                  <td className="px-2 py-1.5 text-right font-mono">
                    {row.avg_price !== null ? formatPrice(row.avg_price) : "—"}
                  </td>
                  <td className="px-2 py-1.5 text-right">
                    {row.cancelled_conditional_orders.length}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {failedCount > 0 ? (
        <div className="rounded-md border border-destructive/35 bg-destructive/10 p-3">
          <p className="mb-2 text-sm font-medium text-destructive">
            Failed positions
          </p>
          <ul className="space-y-1 text-sm">
            {result.failed.map((row) => (
              <li key={row.position_id} className="font-mono">
                {row.symbol}: <span className="text-destructive">{row.error}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

// ─────────────────────────── helpers ─────────────────────────────────────

function formatPrice(value: number): string {
  return value.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

function toUserError(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    if (typeof error.message === "string" && error.message.trim().length > 0) {
      return error.message;
    }
    return fallback;
  }
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }
  return fallback;
}
