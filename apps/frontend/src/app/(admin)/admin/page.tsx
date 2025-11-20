"use client";

/* eslint-disable react/jsx-no-useless-fragment */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { RequireRole } from "@/lib/guards";

const analytics = [
  { label: "API uptime", value: "99.99%", status: "Nominal" },
  { label: "Active admins", value: "12", status: "Within policy" },
  { label: "Security events", value: "0 critical", status: "Clear" },
];

const systemHealth = [
  {
    system: "Realtime orchestration",
    status: "Operational",
    detail: "Latency 120ms · All shards synced",
    tone: "success" as const,
  },
  {
    system: "Media pipelines",
    status: "Degraded",
    detail: "Cloudinary sync queued · Auto scaling",
    tone: "warning" as const,
  },
  {
    system: "Payments",
    status: "Operational",
    detail: "Next rotation: 4h · No chargebacks",
    tone: "success" as const,
  },
];

function AdminContent(): JSX.Element {
  return (
    <div className="space-y-8">
      <div className="border-lumi-border/70 bg-lumi-bg shadow-glow rounded-3xl border p-6">
        <h1 className="text-3xl font-semibold">Admin command center</h1>
        <p className="text-lumi-text-secondary">
          Review analytics, health metrics, and recent privileged actions.
        </p>
      </div>
      <div className="grid gap-6 md:grid-cols-3">
        {analytics.map((item) => (
          <Card key={item.label} className="border-lumi-border/70">
            <CardHeader>
              <CardTitle className="text-lumi-text-secondary text-sm">{item.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold">{item.value}</p>
              <p className="text-lumi-primary text-xs">{item.status}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="border-lumi-border/70 rounded-3xl border p-6">
        <div className="space-y-2">
          <p className="text-lumi-text-secondary text-sm uppercase tracking-[0.3em]">
            System health
          </p>
          <p className="text-lumi-text-secondary text-sm">
            Snapshot of critical services across media, payments, and orchestration engines.
          </p>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {systemHealth.map((item) => (
            <div
              key={item.system}
              className="border-lumi-border/70 bg-lumi-bg-secondary/70 rounded-2xl border p-4"
            >
              <p className="text-sm font-semibold">{item.system}</p>
              <p
                className={`text-xs font-semibold uppercase tracking-[0.3em] ${
                  item.tone === "success" ? "text-lumi-success" : "text-lumi-warning"
                }`}
                aria-label={item.status}
              >
                {item.status}
              </p>
              <p className="text-lumi-text-secondary text-xs">{item.detail}</p>
            </div>
          ))}
        </div>
      </div>

      <Card className="border-lumi-border/70">
        <CardHeader>
          <CardTitle>Recent admin actions</CardTitle>
          <CardDescription>Every privileged change is logged for auditability.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div>
            <p>
              <span className="font-semibold">Leyla Işık</span> granted catalog admin role to Bilge
              Kaya.
            </p>
            <p className="text-lumi-text-secondary text-xs">Today · 10:20 UTC</p>
          </div>
          <Separator className="bg-lumi-border/60" />
          <div>
            <p>
              <span className="font-semibold">Arda Demir</span> rotated JWT signing keys.
            </p>
            <p className="text-lumi-text-secondary text-xs">Yesterday · 17:41 UTC</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function AdminPage(): JSX.Element {
  return (
    <RequireRole role="admin">
      <AdminContent />
    </RequireRole>
  );
}
