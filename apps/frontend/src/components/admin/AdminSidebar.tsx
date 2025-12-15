import { ShieldCheck, Users, Workflow } from "lucide-react";

import Link from "next/link";

import { Button } from "@/components/ui/button";

const adminNav = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/systems", label: "Systems" },
  { href: "/admin/production", label: "Production" },
];

export function AdminSidebar(): JSX.Element {
  return (
    <div className="bg-lumi-bg flex h-full flex-col gap-6 p-6">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <ShieldCheck className="text-lumi-primary h-5 w-5" />
        Admin Console
      </div>
      <nav className="space-y-2">
        {adminNav.map((item) => (
          <Link
            key={item.href}
            href={{ pathname: item.href }}
            className="text-lumi-text-secondary hover:bg-lumi-bg-secondary hover:text-lumi-text block rounded-xl px-3 py-2 text-sm font-semibold"
          >
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="border-lumi-border/60 text-lumi-text-secondary rounded-xl border border-dashed p-4 text-sm">
        <p className="text-lumi-text font-semibold">Staffing</p>
        <p>Assign team owners to sensitive workflows.</p>
        <div className="mt-3 flex gap-2">
          <Button variant="outline" size="icon">
            <Users className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon">
            <Workflow className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
