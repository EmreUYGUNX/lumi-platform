"use client";

import { BarChart3, Home, Layers3, Settings } from "lucide-react";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

export const dashboardNavItems = [
  { href: "/dashboard", icon: Home, label: "Overview" },
  { href: "/dashboard/orders", icon: Layers3, label: "Orders" },
  { href: "/dashboard/analytics", icon: BarChart3, label: "Analytics" },
  { href: "/dashboard/settings", icon: Settings, label: "Settings" },
];

export function DashboardSidebarNav(): JSX.Element {
  const pathname = usePathname();

  return (
    <nav className="space-y-1">
      {dashboardNavItems.map((item) => {
        const Icon = item.icon;
        const active = pathname?.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={{ pathname: item.href }}
            className={cn(
              "flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition",
              active
                ? "bg-lumi-primary/10 text-lumi-primary"
                : "text-lumi-text-secondary hover:bg-lumi-bg-secondary",
            )}
          >
            <Icon className="h-4 w-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
