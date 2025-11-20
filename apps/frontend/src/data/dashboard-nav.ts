import { BarChart3, Home, Layers3, Settings } from "lucide-react";

export const dashboardNavItems = [
  { href: "/dashboard", icon: Home, label: "Overview" },
  { href: "/dashboard/orders", icon: Layers3, label: "Orders" },
  { href: "/dashboard/analytics", icon: BarChart3, label: "Analytics" },
  { href: "/dashboard/settings", icon: Settings, label: "Settings" },
];

export type DashboardNavItem = (typeof dashboardNavItems)[number];
