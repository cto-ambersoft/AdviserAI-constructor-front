"use client";

import { useEffect, useMemo } from "react";

import { visibleMenuGroups, type NavGroup } from "@/lib/navigation";
import { useAuthStore } from "@/stores/auth-store";

/**
 * Shared admin-access + menu-groups resolution for the header and mobile nav
 * (review suggestion — dedupes the identical effect previously copied into
 * profile-menu.tsx and mobile-nav.tsx).
 */
export function useAdminNav(): {
  canOpenAdminPages: boolean;
  groups: NavGroup[];
} {
  const user = useAuthStore((state) => state.user);
  const hasHydrated = useAuthStore((state) => state.hasHydrated);
  const hasAdminAccess = useAuthStore((state) => state.hasAdminAccess);
  const isAdminAccessLoading = useAuthStore((state) => state.isAdminAccessLoading);
  const resolveAdminAccess = useAuthStore((state) => state.resolveAdminAccess);

  const canOpenAdminPages = user?.is_admin === true || hasAdminAccess === true;

  // Resolve admin access once after hydration so the admin group can appear
  // without a manual refresh.
  useEffect(() => {
    if (!hasHydrated || !user) {
      return;
    }
    if (user.is_admin === true || hasAdminAccess !== null || isAdminAccessLoading) {
      return;
    }
    void resolveAdminAccess();
  }, [
    hasAdminAccess,
    hasHydrated,
    isAdminAccessLoading,
    resolveAdminAccess,
    user,
  ]);

  const groups = useMemo(
    () => visibleMenuGroups(canOpenAdminPages),
    [canOpenAdminPages],
  );

  return { canOpenAdminPages, groups };
}
