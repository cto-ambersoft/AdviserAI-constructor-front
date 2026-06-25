"use client";

import { Fragment, useMemo } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, LogOut, User } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAdminNav } from "@/hooks/use-admin-nav";
import { useAuthStore } from "@/stores/auth-store";

/**
 * Secondary navigation + account actions folded into a single dropdown — UX
 * overhaul T2. Menu groups (incl. the admin-gated one) come from
 * {@link useAdminNav}.
 */
export function ProfileMenu() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const { groups } = useAdminNav();

  const initials = useMemo(() => {
    const email = user?.email?.trim() ?? "";
    return email ? email.slice(0, 1).toUpperCase() : "U";
  }, [user?.email]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" className="h-9 gap-2 rounded-sm">
          <span className="flex size-6 items-center justify-center rounded-sm border border-border/80 bg-muted/50 font-mono text-xs font-semibold">
            {initials}
          </span>
          <span className="hidden max-w-[180px] truncate text-sm md:inline">
            {user?.email ?? "anonymous"}
          </span>
          <ChevronDown className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-64">
        <DropdownMenuLabel className="flex items-center gap-2 text-foreground">
          <User className="size-4 text-muted-foreground" />
          <span className="truncate">{user?.email ?? "anonymous"}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {groups.map((group) => (
          <Fragment key={group.id}>
            {group.items.map((item) => (
              <DropdownMenuItem
                key={item.href}
                onSelect={() => router.push(item.href)}
              >
                <item.icon />
                {item.label}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
          </Fragment>
        ))}
        <DropdownMenuItem
          variant="destructive"
          onSelect={() => {
            void logout();
            router.replace("/login");
          }}
        >
          <LogOut />
          Logout
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
