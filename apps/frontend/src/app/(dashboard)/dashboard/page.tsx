"use client";

/* eslint-disable react/jsx-no-useless-fragment */

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { RequireAuth } from "@/lib/guards";

const stats = [
  { label: "GMV", value: "$4.2M", delta: "+22% vs last cycle" },
  { label: "Conversion", value: "3.8%", delta: "+0.4pp" },
  { label: "Support backlog", value: "12", delta: "-31% week over week" },
];

const activities = [
  { actor: "Leyla Işık", action: "Launched summer storefront", timestamp: "2h ago" },
  { actor: "Bilge Kaya", action: "Approved 4 merchant payouts", timestamp: "4h ago" },
  { actor: "Arda Demir", action: "Updated fraud policy", timestamp: "1d ago" },
];

const actionCards = [
  {
    title: "Design new drop",
    description: "Assemble landing pages and merchandising flows for your upcoming release.",
    actionLabel: "Open composer",
    href: "/dashboard/analytics",
  },
  {
    title: "Invite collaborator",
    description: "Provision secure dashboard access with scoped RBAC roles in minutes.",
    actionLabel: "Send invite",
    href: "/dashboard/settings",
  },
  {
    title: "Launch automation",
    description: "Trigger fulfillment, notifications, and Cloudinary media sync in one play.",
    actionLabel: "View runbooks",
    href: "/dashboard/orders",
  },
];

function DashboardContent(): JSX.Element {
  return (
    <div className="space-y-8">
      <div className="border-lumi-border/70 bg-lumi-bg shadow-lumi-primary/5 rounded-3xl border p-6 shadow-lg">
        <p className="text-lumi-text-secondary text-sm uppercase tracking-[0.3em]">Welcome back</p>
        <h1 className="text-3xl font-semibold">Ship the next commerce milestone.</h1>
        <p className="text-lumi-text-secondary">
          Monitor live KPIs, orchestrate workflows, and invite teams into shared route groups.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {stats.map((stat) => (
          <Card key={stat.label} className="border-lumi-border/60">
            <CardHeader>
              <CardTitle className="text-lumi-text-secondary text-sm">{stat.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{stat.value}</p>
              <p className="text-lumi-primary text-xs">{stat.delta}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-lumi-border/60">
        <CardHeader>
          <CardTitle>Recent activity</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {activities.map((event, index) => (
            <div key={event.action}>
              <div className="flex items-center justify-between text-sm">
                <p>
                  <span className="font-semibold">{event.actor}</span> {event.action}
                </p>
                <span className="text-lumi-text-secondary text-xs">{event.timestamp}</span>
              </div>
              {index < activities.length - 1 && <Separator className="bg-lumi-border/60 my-4" />}
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-3">
        {actionCards.map((card) => (
          <Card key={card.title} className="border-lumi-border/60">
            <CardHeader>
              <CardTitle>{card.title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-lumi-text-secondary text-sm">{card.description}</p>
              <Button asChild className="bg-lumi-primary hover:bg-lumi-primary-dark w-full">
                <a href={card.href}>{card.actionLabel}</a>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export default function DashboardHomePage(): JSX.Element {
  return (
    <RequireAuth>
      <DashboardContent />
    </RequireAuth>
  );
}
