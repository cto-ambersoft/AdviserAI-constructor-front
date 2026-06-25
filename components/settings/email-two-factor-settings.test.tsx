import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const { getEmail2FAStatus, enrollEmail2FA, confirmEmail2FA, disableEmail2FA, ApiError } =
  vi.hoisted(() => {
    class ApiError extends Error {
      status: number;
      constructor(status: number, message = "err") {
        super(message);
        this.status = status;
      }
    }
    return {
      getEmail2FAStatus: vi.fn(),
      enrollEmail2FA: vi.fn(),
      confirmEmail2FA: vi.fn(),
      disableEmail2FA: vi.fn(),
      ApiError,
    };
  });

vi.mock("@/lib/api", () => ({
  ApiError,
  getEmail2FAStatus,
  enrollEmail2FA,
  confirmEmail2FA,
  disableEmail2FA,
}));

vi.mock("@/lib/notifications", () => ({
  notifyError: vi.fn(),
  notifySuccess: vi.fn(),
}));

import { EmailTwoFactorSettings } from "@/components/settings/email-two-factor-settings";

describe("EmailTwoFactorSettings", () => {
  beforeEach(() => {
    getEmail2FAStatus.mockReset();
    enrollEmail2FA.mockReset();
    confirmEmail2FA.mockReset();
    disableEmail2FA.mockReset();
  });

  it("shows a not-available message when Resend is unavailable", async () => {
    getEmail2FAStatus.mockResolvedValue({ enabled: false, available: false });
    render(<EmailTwoFactorSettings />);
    expect(await screen.findByText(/email two-factor is not available/i)).toBeInTheDocument();
  });

  it("offers Enable when available and disabled", async () => {
    getEmail2FAStatus.mockResolvedValue({ enabled: false, available: true });
    render(<EmailTwoFactorSettings />);
    expect(
      await screen.findByRole("button", { name: /enable email 2fa/i }),
    ).toBeInTheDocument();
  });

  it("enrolls then confirms to enable", async () => {
    getEmail2FAStatus.mockResolvedValue({ enabled: false, available: true });
    enrollEmail2FA.mockResolvedValue({ sent: true });
    confirmEmail2FA.mockResolvedValue({ enabled: true, available: true });

    render(<EmailTwoFactorSettings />);
    fireEvent.click(await screen.findByRole("button", { name: /enable email 2fa/i }));

    const input = await screen.findByPlaceholderText(/email code/i);
    await waitFor(() => expect(enrollEmail2FA).toHaveBeenCalledOnce());
    fireEvent.change(input, { target: { value: "mail-code-1" } });
    fireEvent.click(screen.getByRole("button", { name: /confirm & enable/i }));

    await waitFor(() => expect(confirmEmail2FA).toHaveBeenCalledWith("mail-code-1"));
    expect(await screen.findByText("Enabled")).toBeInTheDocument();
  });

  it("shows Disable when already enabled", async () => {
    getEmail2FAStatus.mockResolvedValue({ enabled: true, available: true });
    render(<EmailTwoFactorSettings />);
    expect(
      await screen.findByRole("button", { name: /disable email 2fa/i }),
    ).toBeInTheDocument();
  });
});
