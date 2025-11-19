import type { ReactNode } from "react";

import Link from "next/link";
import { redirect } from "next/navigation";

import { CommandPaletteTrigger } from "@/components/dashboard/CommandPaletteTrigger";
import { DashboardSidebarNav } from "@/components/dashboard/DashboardSidebarNav";
import { DashboardTopbar } from "@/components/dashboard/DashboardTopbar";
import { dashboardNavItems } from "@/data/dashboard-nav";
import { getCurrentUser, resolvePreviewUser, shouldEnforceGuards } from "@/lib/session";

interface DashboardLayoutProps {
  children: ReactNode;
  sidebar: ReactNode;
  modal: ReactNode;
}

export default async function DashboardLayout({
  children,
  sidebar,
  modal,
}: DashboardLayoutProps): Promise<JSX.Element> {
  const user = await getCurrentUser();

  if (!user && shouldEnforceGuards) {
    redirect("/login");
  }

  const resolvedUser = user ?? resolvePreviewUser();

  return (
    <div className="bg-lumi-bg-secondary/60 flex min-h-screen">
      <aside className="border-lumi-border/60 hidden w-72 border-r lg:block">{sidebar}</aside>
      <div className="flex flex-1 flex-col">
        <DashboardTopbar user={resolvedUser} />
        <div className="border-lumi-border/60 bg-lumi-bg border-b lg:hidden">
          <details className="px-4 py-3">
            <summary className="text-lumi-text cursor-pointer text-sm font-semibold">
              Navigation
            </summary>
            <div className="border-lumi-border/60 bg-lumi-bg-secondary/60 mt-3 rounded-2xl border p-3">
              <DashboardSidebarNav />
            </div>
          </details>
        </div>
        <div className="border-lumi-border/60 bg-lumi-bg border-b px-6 py-3">
          <CommandPaletteTrigger />
        </div>
        <main className="flex-1 px-6 py-8">{children}</main>
        <nav className="border-lumi-border/60 bg-lumi-bg border-t py-3 lg:hidden">
          <div className="flex items-center justify-around text-xs font-semibold">
            {dashboardNavItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={{ pathname: item.href }}
                  className="flex flex-col items-center gap-1"
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
      {modal}
    </div>
  );
}
