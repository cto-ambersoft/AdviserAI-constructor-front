import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const push = vi.fn();
const replace = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace }),
}));

import { ProfileMenu } from "@/components/layout/profile-menu";
import { useAuthStore } from "@/stores/auth-store";

// Radix uses Pointer Capture + scrollIntoView, which jsdom does not implement.
beforeAll(() => {
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.releasePointerCapture = () => {};
  Element.prototype.scrollIntoView = () => {};
});

function seedStore(overrides: Partial<ReturnType<typeof useAuthStore.getState>>) {
  useAuthStore.setState({
    user: {
      id: 1,
      email: "trader@example.com",
      is_active: true,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
      is_admin: false,
    },
    hasHydrated: true,
    hasAdminAccess: false,
    isAdminAccessLoading: false,
    ...overrides,
  });
}

async function openMenu() {
  const trigger = screen.getByRole("button", { name: /trader@example\.com/i });
  fireEvent.pointerDown(
    trigger,
    new MouseEvent("pointerdown", { bubbles: true }),
  );
  fireEvent.click(trigger);
}

describe("ProfileMenu", () => {
  beforeEach(() => {
    push.mockReset();
    replace.mockReset();
  });

  it("shows the signed-in email on the trigger", () => {
    seedStore({});
    render(<ProfileMenu />);
    expect(
      screen.getByRole("button", { name: /trader@example\.com/i }),
    ).toBeInTheDocument();
  });

  it("exposes secondary links + logout, and hides admin without access", async () => {
    seedStore({ hasAdminAccess: false });
    render(<ProfileMenu />);
    await openMenu();

    expect(await screen.findByText("Connect Exchange")).toBeInTheDocument();
    expect(screen.getByText("Logout")).toBeInTheDocument();
    expect(screen.queryByText("Admin Runtime")).not.toBeInTheDocument();
  });

  it("reveals admin links when the viewer has admin access", async () => {
    seedStore({ hasAdminAccess: true });
    render(<ProfileMenu />);
    await openMenu();

    expect(await screen.findByText("Admin Runtime")).toBeInTheDocument();
    expect(screen.getByText("AI Backtest Config")).toBeInTheDocument();
  });

  it("logs out and redirects to /login on Logout", async () => {
    const logout = vi.fn().mockResolvedValue(undefined);
    seedStore({ logout });
    render(<ProfileMenu />);
    await openMenu();

    fireEvent.click(await screen.findByText("Logout"));
    await waitFor(() => expect(logout).toHaveBeenCalled());
    expect(replace).toHaveBeenCalledWith("/login");
  });
});
