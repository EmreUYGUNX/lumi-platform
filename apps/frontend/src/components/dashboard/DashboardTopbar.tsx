"use client";

import { Bell } from "lucide-react";

import { usePathname } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { LumiUser } from "@/lib/session";

interface DashboardTopbarProps {
  user: LumiUser;
}

export function DashboardTopbar({ user }: DashboardTopbarProps): JSX.Element {
  const pathname = usePathname();
  const segments = pathname?.split("/").filter(Boolean).slice(1) ?? [];

  return (
    <div className="border-lumi-border/60 bg-lumi-bg flex flex-wrap items-center gap-4 border-b px-6 py-4">
      <div>
        <p className="text-lumi-text-secondary text-xs uppercase tracking-[0.3em]">Active path</p>
        <h2 className="text-lg font-semibold capitalize">
          {segments.length > 0 ? segments.join(" / ") : "overview"}
        </h2>
      </div>
      <div className="flex flex-1 flex-wrap items-center justify-end gap-3">
        <Input
          placeholder="Search dashboards, customers, orders..."
          className="w-full max-w-xs"
          aria-label="Search"
        />
        <Button size="icon" variant="ghost" aria-label="Notifications">
          <Bell className="h-4 w-4" />
        </Button>
        <div className="text-right text-sm">
          <p className="font-semibold">{user.name}</p>
          <p className="text-lumi-text-secondary text-xs">{user.email}</p>
        </div>
      </div>
    </div>
  );
}
