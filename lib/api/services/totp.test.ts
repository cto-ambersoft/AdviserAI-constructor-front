import { beforeEach, describe, expect, it, vi } from "vitest";

const apiRequest = vi.fn();
vi.mock("@/lib/api/client", () => ({ apiRequest: (...a: unknown[]) => apiRequest(...a) }));

import { stepUp } from "@/lib/api/services/totp";

describe("stepUp", () => {
  beforeEach(() => {
    apiRequest.mockReset();
    apiRequest.mockResolvedValue({ step_up_token: "t", expires_in: 1 });
  });

  it("defaults to the totp method", async () => {
    await stepUp("123456");
    expect(apiRequest).toHaveBeenCalledWith("/api/v1/auth/2fa/step-up", {
      method: "POST",
      body: { method: "totp", code: "123456" },
    });
  });

  it("sends the email method when requested", async () => {
    await stepUp("mail-code", "email");
    expect(apiRequest).toHaveBeenCalledWith("/api/v1/auth/2fa/step-up", {
      method: "POST",
      body: { method: "email", code: "mail-code" },
    });
  });
});
