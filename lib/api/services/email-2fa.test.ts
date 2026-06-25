import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the low-level client so we assert the path/method/body each service hits.
const apiRequest = vi.fn();
vi.mock("@/lib/api/client", () => ({ apiRequest: (...args: unknown[]) => apiRequest(...args) }));

import {
  confirmEmail2FA,
  disableEmail2FA,
  enrollEmail2FA,
  getEmail2FAStatus,
  requestStepUpEmailCode,
} from "@/lib/api/services/email-2fa";

describe("email-2fa service", () => {
  beforeEach(() => {
    apiRequest.mockReset();
    apiRequest.mockResolvedValue({});
  });

  it("GETs status", async () => {
    await getEmail2FAStatus();
    expect(apiRequest).toHaveBeenCalledWith("/api/v1/auth/2fa/email/status", {
      method: "GET",
    });
  });

  it("POSTs enroll", async () => {
    await enrollEmail2FA();
    expect(apiRequest).toHaveBeenCalledWith("/api/v1/auth/2fa/email/enroll", {
      method: "POST",
    });
  });

  it("POSTs confirm with the code", async () => {
    await confirmEmail2FA("abc123");
    expect(apiRequest).toHaveBeenCalledWith("/api/v1/auth/2fa/email/confirm", {
      method: "POST",
      body: { code: "abc123" },
    });
  });

  it("DELETEs to disable (step-up gated, no token passed)", async () => {
    await disableEmail2FA();
    expect(apiRequest).toHaveBeenCalledWith("/api/v1/auth/2fa/email", {
      method: "DELETE",
    });
  });

  it("POSTs a step-up email-code request", async () => {
    await requestStepUpEmailCode();
    expect(apiRequest).toHaveBeenCalledWith(
      "/api/v1/auth/2fa/step-up/email/request",
      { method: "POST" },
    );
  });
});
