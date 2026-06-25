import {
  Activity,
  ArrowLeftRight,
  Bell,
  Bot,
  CandlestickChart,
  FlaskConical,
  Plug,
  Server,
  ShieldCheck,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

/**
 * Single source of truth for app navigation (UX overhaul T1).
 *
 * The header shows {@link PRIMARY_NAV} (three destinations) inline and folds
 * everything else into a dropdown / mobile sheet built from {@link MENU_GROUPS}.
 * `segment` is the value `useSelectedLayoutSegment()` returns at the `(app)`
 * layout for that route — used to highlight the active primary link without
 * string-parsing the pathname.
 */
export type NavItem = {
  href: string;
  label: string;
  /** First path segment below the `(app)` layout, e.g. `/settings/security` → "settings". */
  segment: string;
  icon: LucideIcon;
};

export type NavGroup = {
  id: string;
  items: NavItem[];
  /** Only rendered for viewers with admin access (see {@link visibleMenuGroups}). */
  adminOnly?: boolean;
};

export const PRIMARY_NAV: NavItem[] = [
  { href: "/strategy", label: "Strategy", segment: "strategy", icon: CandlestickChart },
  { href: "/auto-trade", label: "Auto Trade", segment: "auto-trade", icon: Bot },
  { href: "/monitor", label: "Monitor", segment: "monitor", icon: Activity },
];

export const MENU_GROUPS: NavGroup[] = [
  {
    id: "workspace",
    items: [
      { href: "/trade", label: "Trade", segment: "trade", icon: ArrowLeftRight },
      { href: "/forecasts", label: "Forecasts", segment: "forecasts", icon: Sparkles },
    ],
  },
  {
    id: "settings",
    items: [
      {
        href: "/settings/connect-exchange",
        label: "Connect Exchange",
        segment: "settings",
        icon: Plug,
      },
      {
        href: "/settings/notifications",
        label: "Notifications",
        segment: "settings",
        icon: Bell,
      },
      {
        href: "/settings/security",
        label: "Security",
        segment: "settings",
        icon: ShieldCheck,
      },
    ],
  },
  {
    id: "admin",
    adminOnly: true,
    items: [
      { href: "/admin/runtime", label: "Admin Runtime", segment: "admin", icon: Server },
      {
        href: "/admin/ai-backtest-config",
        label: "AI Backtest Config",
        segment: "admin",
        icon: FlaskConical,
      },
    ],
  },
];

/**
 * Menu groups visible to the current viewer. Admin-only groups are dropped
 * unless `canSeeAdmin` is true, mirroring the header's `canOpenAdminPages` gate.
 */
export function visibleMenuGroups(canSeeAdmin: boolean): NavGroup[] {
  return MENU_GROUPS.filter((group) => !group.adminOnly || canSeeAdmin);
}
