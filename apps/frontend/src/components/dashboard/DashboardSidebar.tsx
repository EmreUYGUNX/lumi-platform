import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { type LumiUser, hasRole, resolvePreviewUser } from "@/lib/session";

import { DashboardSidebarNav } from "./DashboardSidebarNav";

interface DashboardSidebarProps {
  user?: LumiUser;
}

export function DashboardSidebar({
  user = resolvePreviewUser(),
}: DashboardSidebarProps): JSX.Element {
  const initials = user.name
    .split(" ")
    .map((token) => token[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="bg-lumi-bg flex h-full flex-col gap-6 p-6">
      <div className="flex items-center gap-3">
        <Avatar>
          <AvatarImage src={user.avatarUrl} alt={user.name} />
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
        <div>
          <p className="text-sm font-semibold">{user.name}</p>
          <p className="text-lumi-text-secondary text-xs capitalize">{user.tier} tier</p>
        </div>
      </div>
      <DashboardSidebarNav />
      <div className="border-lumi-border/70 rounded-xl border border-dashed p-3">
        <p className="text-sm font-semibold">Quick actions</p>
        <div className="mt-2 flex flex-col gap-2">
          <Button variant="secondary" className="justify-start">
            Create product
          </Button>
          <Button variant="ghost" className="justify-start">
            Invite teammate
          </Button>
          {hasRole(user, "admin") ? (
            <Button variant="ghost" className="justify-start" asChild>
              <a href="/admin">Go to admin</a>
            </Button>
          ) : undefined}
        </div>
      </div>
    </div>
  );
}
