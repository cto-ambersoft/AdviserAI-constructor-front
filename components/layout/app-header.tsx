"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth-store";

const NAV_LINKS = [
  { href: "/strategy", label: "Strategy" },
  { href: "/trade", label: "Trade" },
  { href: "/settings/connect-exchange", label: "Connect Exchange" },
];

export function AppHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isMenuOpen) {
      return;
    }

    const onClickOutside = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsMenuOpen(false);
      }
    };

    window.addEventListener("mousedown", onClickOutside);
    window.addEventListener("keydown", onEscape);
    return () => {
      window.removeEventListener("mousedown", onClickOutside);
      window.removeEventListener("keydown", onEscape);
    };
  }, [isMenuOpen]);

  const userInitials = useMemo(() => {
    const email = user?.email?.trim() ?? "";
    if (!email) {
      return "U";
    }
    return email.slice(0, 1).toUpperCase();
  }, [user?.email]);

  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-background/92 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-[1600px] items-center justify-between gap-3 px-4 md:px-6">
        <div className="flex items-center gap-3">
          <Link className="text-sm font-semibold tracking-tight" href="/strategy">
            Constructor Trade
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            {NAV_LINKS.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground",
                    isActive && "bg-muted text-foreground",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="relative" ref={menuRef}>
          <Button
            type="button"
            variant="outline"
            className="h-9 gap-2"
            onClick={() => setIsMenuOpen((prev) => !prev)}
          >
            <span className="flex size-6 items-center justify-center rounded-full border bg-muted text-xs font-semibold">
              {userInitials}
            </span>
            <span className="hidden max-w-[180px] truncate text-sm md:inline">{user?.email ?? "anonymous"}</span>
            <ChevronDown className="size-4" />
          </Button>

          {isMenuOpen ? (
            <div className="absolute right-0 mt-2 w-64 rounded-md border border-border/80 bg-popover/95 p-1 shadow-lg backdrop-blur">
              <div className="flex items-center gap-2 px-2 py-2">
                <User className="size-4 text-muted-foreground" />
                <p className="truncate text-sm font-medium">{user?.email ?? "anonymous"}</p>
              </div>
              <div className="my-1 h-px bg-border" />
              <button
                type="button"
                className="w-full rounded-sm px-2 py-2 text-left text-sm hover:bg-muted"
                onClick={() => {
                  setIsMenuOpen(false);
                  router.push("/settings/connect-exchange");
                }}
              >
                Connect Exchange
              </button>
              <button
                type="button"
                className="w-full rounded-sm px-2 py-2 text-left text-sm hover:bg-muted"
                onClick={() => {
                  setIsMenuOpen(false);
                  router.push("/trade");
                }}
              >
                Open Trade
              </button>
              <div className="my-1 h-px bg-border" />
              <button
                type="button"
                className="w-full rounded-sm px-2 py-2 text-left text-sm text-destructive hover:bg-destructive/12"
                onClick={() => {
                  void logout();
                  setIsMenuOpen(false);
                  router.replace("/login");
                }}
              >
                Logout
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
