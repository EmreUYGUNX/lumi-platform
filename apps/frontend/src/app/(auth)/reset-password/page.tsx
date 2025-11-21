"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// Avoid static prerender; run at request time.
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function ResetPasswordPage(): JSX.Element {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Set a new password</h1>
        <p className="text-lumi-text-secondary text-sm">
          For security reasons we enforce 12+ characters and passkey readiness.
        </p>
      </div>
      <form className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-semibold">New password</label>
          <Input type="password" placeholder="••••••••••••" defaultValue="" />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-semibold">Confirm password</label>
          <Input type="password" placeholder="Again please" defaultValue="" />
        </div>
        <Button type="button" className="w-full">
          Update password
        </Button>
      </form>
    </div>
  );
}
