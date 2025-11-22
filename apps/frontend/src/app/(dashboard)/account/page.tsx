"use client";

import { useMemo } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { AccountOverview } from "@/features/account/components/AccountOverview";
import { useProfile } from "@/features/account/hooks/useProfile";
import type { ActivityItem, AccountStats } from "@/features/account/types";

const recentActivity: ActivityItem[] = [
  {
    id: "act1",
    title: "Login from Chrome",
    description: "Istanbul, TR · IP masked",
    timestamp: new Date().toISOString(),
    type: "login",
  },
  {
    id: "act2",
    title: "Password changed",
    description: "Security center",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(),
    type: "security",
  },
  {
    id: "act3",
    title: "Profile updated",
    description: "Phone number verified",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    type: "profile",
  },
];

const stats: AccountStats = {
  orders: 12,
  wishlist: 7,
  reviews: 3,
  completion: 76,
};

export default function AccountOverviewPage(): JSX.Element {
  const { data: profile, isLoading } = useProfile();

  const activity = useMemo(() => recentActivity, []);

  if (isLoading || !profile) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return <AccountOverview profile={profile} stats={stats} activity={activity} />;
}
