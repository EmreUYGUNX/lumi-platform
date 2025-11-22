import { Activity, MailWarning, ShieldAlert, UserRound, type LucideIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ActivityTimeline } from "@/components/ui/feedback/ActivityTimeline";
import { InlineBanner } from "@/components/ui/feedback/InlineBanner";

import type { AccountStats, ActivityItem, AccountProfile } from "../types";

interface AccountOverviewProps {
  profile: AccountProfile;
  stats: AccountStats;
  activity: ActivityItem[];
}

const quickActions = [
  { label: "Update profile", href: "/account/profile" },
  { label: "Add address", href: "/account/addresses/new" },
  { label: "Manage sessions", href: "/account/sessions" },
];

export function AccountOverview({ profile, stats, activity }: AccountOverviewProps): JSX.Element {
  const securityAlerts: { title: string; description: string; icon: LucideIcon }[] = [];
  if (!profile.emailVerified) {
    securityAlerts.push({
      title: "Email not verified",
      description: "Verify your email to secure your account.",
      icon: MailWarning,
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-lumi-text-secondary text-sm">Welcome back</p>
          <h1 className="text-2xl font-semibold">{profile.fullName}</h1>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <a href="/account/profile">Edit profile</a>
          </Button>
          <Button asChild size="sm">
            <a href="/account/security">Security check</a>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Account completion</CardTitle>
          <CardDescription>Keep your profile and security up to date.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Progress value={stats.completion} />
          <div className="text-lumi-text-secondary flex flex-wrap gap-2 text-xs">
            <Badge variant="outline">Email verified</Badge>
            <Badge variant="outline">Security baseline</Badge>
            <Badge variant="outline">Profile completed</Badge>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        {[
          { label: "Orders", value: stats.orders, icon: Activity },
          { label: "Wishlist", value: stats.wishlist, icon: UserRound },
          { label: "Reviews", value: stats.reviews, icon: ShieldAlert },
        ].map((item) => (
          <Card key={item.label} className="shadow-none">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{item.label}</CardTitle>
              <item.icon className="text-lumi-text-secondary h-4 w-4" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{item.value}</div>
              <p className="text-lumi-text-secondary text-xs">Last 30 days</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
            <CardDescription>Latest account events and security signals.</CardDescription>
          </CardHeader>
          <CardContent>
            <ActivityTimeline
              items={activity.map((entry) => ({
                id: entry.id,
                title: entry.title,
                description: entry.description,
                timestamp: entry.timestamp,
                variant:
                  entry.type === "security"
                    ? "warning"
                    : entry.type === "order"
                      ? "info"
                      : "default",
              }))}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Quick actions</CardTitle>
            <CardDescription>Jump to frequently used workflows.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {quickActions.map((action) => (
              <Button key={action.label} variant="ghost" className="w-full justify-between" asChild>
                <a href={action.href}>
                  <span>{action.label}</span>
                  <span className="text-lumi-text-secondary">↗</span>
                </a>
              </Button>
            ))}
            {securityAlerts.length > 0 && (
              <div className="space-y-2">
                {securityAlerts.map((alert) => (
                  <InlineBanner
                    key={alert.title}
                    icon={alert.icon}
                    title={alert.title}
                    description={alert.description}
                    variant="warning"
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
