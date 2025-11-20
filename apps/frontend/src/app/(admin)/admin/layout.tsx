import type { ReactNode } from "react";

import { redirect } from "next/navigation";

import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AdminTopbar } from "@/components/admin/AdminTopbar";
import { getCurrentUser, hasRole, shouldEnforceGuards } from "@/lib/session";

interface AdminLayoutProps {
  children: ReactNode;
}

export default async function AdminLayout({ children }: AdminLayoutProps): Promise<JSX.Element> {
  const user = await getCurrentUser();

  if (shouldEnforceGuards) {
    if (!user) {
      redirect("/login");
    }
    if (user && !hasRole(user, "admin")) {
      redirect("/dashboard");
    }
  }

  return (
    <div className="bg-lumi-bg-secondary/40 flex min-h-screen">
      <aside className="border-lumi-border/60 hidden w-72 border-r lg:block">
        <AdminSidebar />
      </aside>
      <div className="flex flex-1 flex-col">
        <AdminTopbar />
        <main className="flex-1 px-6 py-8">{children}</main>
      </div>
    </div>
  );
}
