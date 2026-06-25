import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

const getHealthStatus = vi.fn();

vi.mock("@/lib/api", () => ({
  getHealthStatus: () => getHealthStatus(),
}));

import { StatusIndicator } from "@/components/layout/status-indicator";

describe("StatusIndicator", () => {
  beforeEach(() => {
    getHealthStatus.mockReset();
  });

  it("shows a stable pill when the API reports ok", async () => {
    getHealthStatus.mockResolvedValue({ status: "ok" });
    render(<StatusIndicator />);
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /api status: connection stable/i }),
      ).toBeInTheDocument(),
    );
  });

  it("shows a degraded pill for a degraded status", async () => {
    getHealthStatus.mockResolvedValue({ status: "degraded" });
    render(<StatusIndicator />);
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /api status: degraded/i }),
      ).toBeInTheDocument(),
    );
  });

  it("shows a disconnected pill when the health request fails", async () => {
    getHealthStatus.mockRejectedValue(new Error("network"));
    render(<StatusIndicator />);
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /api status: disconnected/i }),
      ).toBeInTheDocument(),
    );
  });
});
