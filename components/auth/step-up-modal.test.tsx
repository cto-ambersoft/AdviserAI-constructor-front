import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const { getTotpStatus, getEmail2FAStatus, requestStepUpEmailCode, stepUp, ApiError } =
  vi.hoisted(() => {
    class ApiError extends Error {
      status: number;
      retryAfterSeconds?: number;
      constructor(status: number, message = "err") {
        super(message);
        this.status = status;
      }
    }
    return {
      getTotpStatus: vi.fn(),
      getEmail2FAStatus: vi.fn(),
      requestStepUpEmailCode: vi.fn(),
      stepUp: vi.fn(),
      ApiError,
    };
  });

vi.mock("@/lib/api", () => ({
  ApiError,
  getTotpStatus,
  getEmail2FAStatus,
  requestStepUpEmailCode,
  stepUp,
}));

import { StepUpModal } from "@/components/auth/step-up-modal";

describe("StepUpModal", () => {
  beforeEach(() => {
    getTotpStatus.mockReset();
    getEmail2FAStatus.mockReset();
    requestStepUpEmailCode.mockReset();
    stepUp.mockReset();
  });

  it("auto-selects TOTP and shows the code input when it is the only factor", async () => {
    getTotpStatus.mockResolvedValue({ enabled: true });
    getEmail2FAStatus.mockResolvedValue({ enabled: false, available: true });

    render(<StepUpModal open onResolved={vi.fn()} onCancel={vi.fn()} />);

    const input = await screen.findByPlaceholderText(/6-digit code or recovery code/i);
    expect(input).toBeInTheDocument();
    // No factor picker when there is only one factor.
    expect(screen.queryByText(/Email me a code/i)).not.toBeInTheDocument();
  });

  it("shows a factor picker when both factors are available", async () => {
    getTotpStatus.mockResolvedValue({ enabled: true });
    getEmail2FAStatus.mockResolvedValue({ enabled: true, available: true });

    render(<StepUpModal open onResolved={vi.fn()} onCancel={vi.fn()} />);

    expect(await screen.findByText(/Authenticator code/i)).toBeInTheDocument();
    expect(screen.getByText(/Email me a code/i)).toBeInTheDocument();
  });

  it("runs the email flow: send code → enter code → resolves with the token", async () => {
    getTotpStatus.mockResolvedValue({ enabled: false });
    getEmail2FAStatus.mockResolvedValue({ enabled: true, available: true });
    requestStepUpEmailCode.mockResolvedValue({ sent: true });
    stepUp.mockResolvedValue({ step_up_token: "tok-123", expires_in: 300 });
    const onResolved = vi.fn();

    render(<StepUpModal open onResolved={onResolved} onCancel={vi.fn()} />);

    // Email is the only factor → auto-selected → "Send code" first.
    const sendBtn = await screen.findByRole("button", { name: /send code/i });
    fireEvent.click(sendBtn);
    await waitFor(() => expect(requestStepUpEmailCode).toHaveBeenCalledOnce());

    const input = await screen.findByPlaceholderText(/email code/i);
    fireEvent.change(input, { target: { value: "mail-code-1" } });
    fireEvent.click(screen.getByRole("button", { name: /^confirm$/i }));

    await waitFor(() => expect(stepUp).toHaveBeenCalledWith("mail-code-1", "email"));
    await waitFor(() => expect(onResolved).toHaveBeenCalledWith("tok-123"));
  });

  it("submits a TOTP code with the totp method", async () => {
    getTotpStatus.mockResolvedValue({ enabled: true });
    getEmail2FAStatus.mockResolvedValue({ enabled: false, available: false });
    stepUp.mockResolvedValue({ step_up_token: "tok-totp", expires_in: 300 });
    const onResolved = vi.fn();

    render(<StepUpModal open onResolved={onResolved} onCancel={vi.fn()} />);

    const input = await screen.findByPlaceholderText(/6-digit code or recovery code/i);
    fireEvent.change(input, { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: /^confirm$/i }));

    await waitFor(() => expect(stepUp).toHaveBeenCalledWith("123456", "totp"));
    await waitFor(() => expect(onResolved).toHaveBeenCalledWith("tok-totp"));
  });
});
