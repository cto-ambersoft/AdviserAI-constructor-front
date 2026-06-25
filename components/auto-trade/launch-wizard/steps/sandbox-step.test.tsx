import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const upsertAutoTradeConfig = vi.fn();
const playAutoTrade = vi.fn();

vi.mock("@/lib/api", () => ({
  upsertAutoTradeConfig: (...args: unknown[]) => upsertAutoTradeConfig(...args),
  playAutoTrade: (...args: unknown[]) => playAutoTrade(...args),
  ApiError: class ApiError extends Error {},
}));

const notifyError = vi.fn();
vi.mock("@/lib/notifications", () => ({
  notifyError: (...args: unknown[]) => notifyError(...args),
  notifySuccess: vi.fn(),
}));

import { SandboxStep } from "@/components/auto-trade/launch-wizard/steps/sandbox-step";

describe("SandboxStep", () => {
  beforeEach(() => {
    upsertAutoTradeConfig.mockReset();
    playAutoTrade.mockReset();
    notifyError.mockReset();
  });

  it("creates the config, starts it, and records the config id", async () => {
    upsertAutoTradeConfig.mockResolvedValue({ id: 77 });
    playAutoTrade.mockResolvedValue({});
    const dispatch = vi.fn();

    render(
      <SandboxStep
        data={{ profileId: 1, accountId: 5, positionSizeUsdt: 100 }}
        dispatch={dispatch}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /start in sandbox/i }));

    await waitFor(() => expect(playAutoTrade).toHaveBeenCalledWith({ account_id: 5 }));
    expect(upsertAutoTradeConfig).toHaveBeenCalledWith(
      expect.objectContaining({ profile_id: 1, account_id: 5, position_size_usdt: 100 }),
    );
    expect(dispatch).toHaveBeenCalledWith({
      type: "set",
      patch: { configId: 77 },
    });
  });

  it("notifies (does not throw) when a non-API error occurs", async () => {
    upsertAutoTradeConfig.mockRejectedValue(new Error("boom"));
    render(
      <SandboxStep
        data={{ profileId: 1, accountId: 5, positionSizeUsdt: 100 }}
        dispatch={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /start in sandbox/i }));
    await waitFor(() => expect(notifyError).toHaveBeenCalled());
  });

  it("shows a running confirmation once a config exists", () => {
    render(
      <SandboxStep
        data={{ profileId: 1, accountId: 5, positionSizeUsdt: 100, configId: 77 }}
        dispatch={vi.fn()}
      />,
    );
    expect(screen.getByText(/running in sandbox/i)).toBeInTheDocument();
  });
});
