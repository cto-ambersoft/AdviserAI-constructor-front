"use client";

import { Fragment, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Menu } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useAdminNav } from "@/hooks/use-admin-nav";
import { PRIMARY_NAV } from "@/lib/navigation";
import { useAuthStore } from "@/stores/auth-store";

const ITEM_CLASS =
  "flex w-full items-center gap-3 rounded-sm px-2 py-2.5 text-left text-sm font-medium text-foreground transition-colors hover:bg-muted/65 [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted-foreground";

/**
 * Mobile (`< md`) navigation. A single hamburger opens a Sheet holding every
 * destination — primary links, secondary groups, and account actions — so the
 * whole app is reachable without the desktop header. UX overhaul T3.
 */
export function MobileNav() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const { groups } = useAdminNav();

  const navigate = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="rounded-sm md:hidden"
          aria-label="Open menu"
        >
          <Menu className="size-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72">
        <SheetHeader className="sr-only">
          <SheetTitle>Navigation</SheetTitle>
          <SheetDescription>Application navigation menu.</SheetDescription>
        </SheetHeader>

        <p className="truncate px-2 pt-1 text-sm font-medium text-muted-foreground">
          {user?.email ?? "anonymous"}
        </p>

        <nav className="mt-2 flex flex-col gap-0.5">
          {PRIMARY_NAV.map((item) => (
            <button
              key={item.href}
              type="button"
              className={ITEM_CLASS}
              onClick={() => navigate(item.href)}
            >
              <item.icon />
              {item.label}
            </button>
          ))}

          {groups.map((group) => (
            <Fragment key={group.id}>
              <div className="my-1 h-px bg-border" />
              {group.items.map((item) => (
                <button
                  key={item.href}
                  type="button"
                  className={ITEM_CLASS}
                  onClick={() => navigate(item.href)}
                >
                  <item.icon />
                  {item.label}
                </button>
              ))}
            </Fragment>
          ))}

          <div className="my-1 h-px bg-border" />
          <button
            type="button"
            className="flex w-full items-center gap-3 rounded-sm px-2 py-2.5 text-left text-sm font-medium text-destructive transition-colors hover:bg-destructive/12 [&_svg]:size-4 [&_svg]:shrink-0"
            onClick={() => {
              setOpen(false);
              void logout();
              router.replace("/login");
            }}
          >
            <LogOut />
            Logout
          </button>
        </nav>
      </SheetContent>
    </Sheet>
  );
}
