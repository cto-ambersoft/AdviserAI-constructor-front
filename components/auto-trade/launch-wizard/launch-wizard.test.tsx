import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

const listPersonalAnalysisProfiles = vi.fn();
const listExchangeAccounts = vi.fn().mockResolvedValue([]);
vi.mock("@/lib/api", () => ({
  listPersonalAnalysisProfiles: () => listPersonalAnalysisProfiles(),
  listExchangeAccounts: () => listExchangeAccounts(),
  runAtrOrderBlockBacktest: vi.fn(),
  upsertAutoTradeConfig: vi.fn(),
  playAutoTrade: vi.fn(),
  getPromotionStatus: vi.fn().mockResolvedValue(null),
  promoteStrategy: vi.fn(),
  ApiError: class ApiError extends Error {},
}));

import { LaunchWizard } from "@/components/auto-trade/launch-wizard/launch-wizard";

const PROFILES = [{ id: 1, symbol: "BTCUSDT" }];

describe("LaunchWizard shell", () => {
  it("starts on Strategy with Back disabled and Next gated", async () => {
    listPersonalAnalysisProfiles.mockResolvedValue(PROFILES);
    render(<LaunchWizard />);
    await waitFor(() =>
      expect(screen.getByRole("option", { name: "BTCUSDT" })).toBeInTheDocument(),
    );
    expect(screen.getByRole("button", { name: "Back" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
  });

  it("enables Next once a profile is selected and advances to Backtest", async () => {
    listPersonalAnalysisProfiles.mockResolvedValue(PROFILES);
    render(<LaunchWizard />);
    await waitFor(() =>
      expect(screen.getByRole("option", { name: "BTCUSDT" })).toBeInTheDocument(),
    );

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "1" } });
    const next = screen.getByRole("button", { name: "Next" });
    expect(next).toBeEnabled();

    fireEvent.click(next);
    expect(screen.getByRole("button", { name: /run backtest/i })).toBeInTheDocument();
  });

  it("cancels back to the auto-trade dashboard", async () => {
    listPersonalAnalysisProfiles.mockResolvedValue(PROFILES);
    render(<LaunchWizard />);
    // Let the initial data load settle so the click doesn't race a state update.
    await screen.findByRole("option", { name: "BTCUSDT" });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(push).toHaveBeenCalledWith("/auto-trade");
  });

  it("shows a retry banner when loading fails", async () => {
    listPersonalAnalysisProfiles.mockRejectedValue(new Error("network"));
    render(<LaunchWizard />);
    expect(
      await screen.findByText(/couldn't load profiles or accounts/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });
});
