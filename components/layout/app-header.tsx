"use client";

import Link from "next/link";
import Image from "next/image";

import { MobileNav } from "@/components/layout/mobile-nav";
import { NavLink } from "@/components/layout/nav-link";
import { ProfileMenu } from "@/components/layout/profile-menu";
import { StatusIndicator } from "@/components/layout/status-indicator";
import { PRIMARY_NAV } from "@/lib/navigation";

export function AppHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/90 bg-background/95 backdrop-blur-sm">
      <div className="mx-auto flex h-14 w-full max-w-[1600px] items-center justify-between gap-3 px-4 md:px-6">
        <div className="flex items-center gap-3">
          <MobileNav />
          <Link className="items-center" href="/strategy" aria-label="Home">
            <Image
              src="/ai-trader.svg"
              alt="Tradex logo"
              width={22}
              height={22}
              className="size-[22px]"
              priority
            />
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            {PRIMARY_NAV.map((item) => (
              <NavLink key={item.href} item={item} />
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <StatusIndicator />
          {/* Profile dropdown is desktop-only; mobile uses the hamburger sheet. */}
          <div className="hidden md:block">
            <ProfileMenu />
          </div>
        </div>
      </div>
    </header>
  );
}
