"use client";

import Link from "next/link";
import { useSelectedLayoutSegment } from "next/navigation";

import { cn } from "@/lib/utils";
import type { NavItem } from "@/lib/navigation";

/**
 * Primary header link. Active state is derived from the `(app)` layout's
 * selected segment (not pathname string-matching) so it stays correct across
 * nested routes — UX overhaul T2.
 */
export function NavLink({
  item,
  className,
}: {
  item: NavItem;
  className?: string;
}) {
  const segment = useSelectedLayoutSegment();
  const isActive = segment === item.segment;

  return (
    <Link
      href={item.href}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "rounded-sm border border-transparent px-3 py-1.5 text-sm font-medium transition-colors duration-150",
        isActive
          ? "text-primary"
          : "text-foreground hover:bg-primary/10 hover:text-primary",
        className,
      )}
    >
      {item.label}
    </Link>
  );
}
