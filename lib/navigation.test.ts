import { describe, expect, it } from "vitest";

import {
  PRIMARY_NAV,
  MENU_GROUPS,
  visibleMenuGroups,
  type NavItem,
} from "@/lib/navigation";

function allItems(): NavItem[] {
  return [...PRIMARY_NAV, ...MENU_GROUPS.flatMap((group) => group.items)];
}

describe("navigation model", () => {
  it("exposes exactly three primary destinations", () => {
    expect(PRIMARY_NAV).toHaveLength(3);
    expect(PRIMARY_NAV.map((item) => item.href)).toEqual([
      "/strategy",
      "/auto-trade",
      "/monitor",
    ]);
  });

  it("gives every item an href, label, segment and icon", () => {
    for (const item of allItems()) {
      expect(item.href.startsWith("/")).toBe(true);
      expect(item.label.trim().length).toBeGreaterThan(0);
      expect(item.segment.length).toBeGreaterThan(0);
      // lucide icons are forwardRef components (objects), not bare functions.
      expect(item.icon).toBeTruthy();
    }
  });

  it("flags exactly one admin-only group and it holds the admin routes", () => {
    const adminGroups = MENU_GROUPS.filter((group) => group.adminOnly === true);
    expect(adminGroups).toHaveLength(1);
    expect(adminGroups[0].items.map((item) => item.href)).toEqual([
      "/admin/runtime",
      "/admin/ai-backtest-config",
    ]);
  });

  it("has no duplicate hrefs across primary + menu groups", () => {
    const hrefs = allItems().map((item) => item.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it("hides admin-only groups unless the viewer has admin access", () => {
    const withoutAdmin = visibleMenuGroups(false);
    expect(withoutAdmin.some((group) => group.adminOnly)).toBe(false);

    const withAdmin = visibleMenuGroups(true);
    expect(withAdmin.some((group) => group.adminOnly)).toBe(true);
    // non-admin groups are always present in both views
    expect(withoutAdmin.length).toBe(
      MENU_GROUPS.filter((group) => !group.adminOnly).length,
    );
    expect(withAdmin.length).toBe(MENU_GROUPS.length);
  });
});
