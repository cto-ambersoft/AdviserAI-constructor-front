import { afterEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

import { useAdminNav } from "@/hooks/use-admin-nav";
import { useAuthStore } from "@/stores/auth-store";

function seed(overrides: Partial<ReturnType<typeof useAuthStore.getState>>) {
  useAuthStore.setState({
    user: {
      id: 1,
      email: "t@example.com",
      is_active: true,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
      is_admin: false,
    },
    hasHydrated: true,
    hasAdminAccess: false,
    isAdminAccessLoading: false,
    resolveAdminAccess: vi.fn().mockResolvedValue(false),
    ...overrides,
  });
}

afterEach(() => {
  useAuthStore.setState({ hasAdminAccess: null });
});

describe("useAdminNav", () => {
  it("hides admin groups for a non-admin viewer", () => {
    seed({ hasAdminAccess: false });
    const { result } = renderHook(() => useAdminNav());
    expect(result.current.canOpenAdminPages).toBe(false);
    expect(result.current.groups.some((g) => g.adminOnly)).toBe(false);
  });

  it("exposes admin groups when the viewer has access", () => {
    seed({ hasAdminAccess: true });
    const { result } = renderHook(() => useAdminNav());
    expect(result.current.canOpenAdminPages).toBe(true);
    expect(result.current.groups.some((g) => g.adminOnly)).toBe(true);
  });

  it("treats is_admin users as admins without resolving", () => {
    const resolveAdminAccess = vi.fn();
    seed({
      hasAdminAccess: null,
      user: {
        id: 1,
        email: "a@example.com",
        is_active: true,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
        is_admin: true,
      },
      resolveAdminAccess,
    });
    const { result } = renderHook(() => useAdminNav());
    expect(result.current.canOpenAdminPages).toBe(true);
    expect(resolveAdminAccess).not.toHaveBeenCalled();
  });

  it("resolves admin access once after hydration when unknown", async () => {
    const resolveAdminAccess = vi.fn().mockResolvedValue(false);
    seed({ hasAdminAccess: null, isAdminAccessLoading: false, resolveAdminAccess });
    renderHook(() => useAdminNav());
    await waitFor(() => expect(resolveAdminAccess).toHaveBeenCalledTimes(1));
  });
});
