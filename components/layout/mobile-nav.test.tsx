import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const push = vi.fn();
const replace = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace }),
}));

import { MobileNav } from "@/components/layout/mobile-nav";
import { useAuthStore } from "@/stores/auth-store";

// Radix Dialog relies on Pointer Capture + scrollIntoView (absent in jsdom).
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

function openSheet() {
  const trigger = screen.getByRole("button", { name: /open menu/i });
  fireEvent.pointerDown(
    trigger,
    new MouseEvent("pointerdown", { bubbles: true }),
  );
  fireEvent.click(trigger);
}

describe("MobileNav", () => {
  beforeEach(() => {
    push.mockReset();
    replace.mockReset();
  });

  it("shows every primary + secondary destination and logout when opened", async () => {
    seedStore({});
    render(<MobileNav />);
    openSheet();

    expect(await screen.findByText("Strategy")).toBeInTheDocument();
    expect(screen.getByText("Auto Trade")).toBeInTheDocument();
    expect(screen.getByText("Monitor")).toBeInTheDocument();
    expect(screen.getByText("Connect Exchange")).toBeInTheDocument();
    expect(screen.getByText("Logout")).toBeInTheDocument();
  });

  it("hides admin routes without access and shows them with access", async () => {
    seedStore({ hasAdminAccess: false });
    const { unmount } = render(<MobileNav />);
    openSheet();
    expect(await screen.findByText("Monitor")).toBeInTheDocument();
    expect(screen.queryByText("Admin Runtime")).not.toBeInTheDocument();
    unmount();

    seedStore({ hasAdminAccess: true });
    render(<MobileNav />);
    openSheet();
    expect(await screen.findByText("Admin Runtime")).toBeInTheDocument();
  });

  it("navigates and closes the sheet when a destination is selected", async () => {
    seedStore({});
    render(<MobileNav />);
    openSheet();

    fireEvent.click(await screen.findByText("Monitor"));
    expect(push).toHaveBeenCalledWith("/monitor");
    await waitFor(() =>
      expect(screen.queryByText("Connect Exchange")).not.toBeInTheDocument(),
    );
  });

  it("logs out and redirects to /login", async () => {
    const logout = vi.fn().mockResolvedValue(undefined);
    seedStore({ logout });
    render(<MobileNav />);
    openSheet();

    fireEvent.click(await screen.findByText("Logout"));
    await waitFor(() => expect(logout).toHaveBeenCalled());
    expect(replace).toHaveBeenCalledWith("/login");
  });
});
