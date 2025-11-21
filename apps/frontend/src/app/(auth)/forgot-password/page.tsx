"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// Avoid static prerender; run at request time.
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function ForgotPasswordPage(): JSX.Element {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Link href="/login" className="text-lumi-primary text-sm hover:underline">
          Back to login
        </Link>
        <h1 className="text-2xl font-semibold">Reset your password</h1>
        <p className="text-lumi-text-secondary text-sm">
          We’ll send you a secure link to restore account access.
        </p>
      </div>
      <form className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-semibold">Email</label>
          <Input type="email" placeholder="ops@lumi.com" defaultValue="" />
        </div>
        <Button type="button" className="w-full">
          Send recovery link
        </Button>
      </form>
    </div>
  );
}
