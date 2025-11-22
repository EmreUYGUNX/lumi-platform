"use client";

import { Lock, ShieldCheck, Smartphone, Timer } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { InlineBanner } from "@/components/ui/feedback/InlineBanner";
import { PasswordStrength } from "@/features/auth/components/PasswordStrength";
import { sessionStore } from "@/store/session";

const recommendations = [
  { title: "Enable two-factor", description: "Add a second factor to secure sign-in." },
  { title: "Review trusted devices", description: "Revoke sessions you don't recognize." },
  { title: "Rotate password quarterly", description: "Keep your account hygiene healthy." },
];

export function SecurityCenter(): JSX.Element {
  const trustedDevices = sessionStore.getState().trustedDevices.length;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Security center</h1>
        <p className="text-lumi-text-secondary text-sm">
          Monitor password strength, devices, and verification status.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Password strength</CardTitle>
            <Lock className="text-lumi-text-secondary h-4 w-4" />
          </CardHeader>
          <CardContent>
            <PasswordStrength value="Sup3rSecur3!" />
            <p className="text-lumi-text-secondary mt-2 text-xs">Last changed 45 days ago</p>
            <Button variant="ghost" size="sm" asChild className="text-lumi-primary mt-2 p-0">
              <a href="/account/security/password">Change password</a>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Two-factor</CardTitle>
            <ShieldCheck className="text-lumi-text-secondary h-4 w-4" />
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm font-semibold">Planned</p>
            <p className="text-lumi-text-secondary text-xs">
              2FA will be enabled in Phase 16. Meanwhile keep your password strong.
            </p>
            <Badge variant="outline">Coming soon</Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Trusted devices</CardTitle>
            <Smartphone className="text-lumi-text-secondary h-4 w-4" />
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-2xl font-semibold">{trustedDevices}</p>
            <p className="text-lumi-text-secondary text-xs">
              Manage trusted devices in Sessions to revoke stale sign-ins.
            </p>
            <Button variant="ghost" size="sm" asChild className="text-lumi-primary p-0">
              <a href="/account/sessions">View sessions</a>
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Security posture</CardTitle>
          <CardDescription>Recommended actions to stay compliant.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-3">
            <InlineBanner
              title="Idle timeout enabled"
              description="Sessions end after 15 minutes of inactivity."
              icon={Timer}
              variant="info"
            />
            <InlineBanner
              title="Unusual activity detection"
              description="We flag suspicious sign-ins and notify you via email."
              icon={ShieldCheck}
              variant="success"
            />
          </div>
          <div className="space-y-3">
            {recommendations.map((item) => (
              <div key={item.title} className="border-lumi-border/60 rounded-xl border p-3">
                <p className="font-semibold">{item.title}</p>
                <p className="text-lumi-text-secondary text-sm">{item.description}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
