"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// Prevent prerender during build; this client page should render at runtime.
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function RegisterPage(): JSX.Element {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Create your Lumi account</h1>
        <p className="text-lumi-text-secondary text-sm">
          Provisioned tenants include access to dashboard, admin, and media pipelines.
        </p>
      </div>

      <form className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-semibold">Full name</label>
          <Input placeholder="Leyla Işık" defaultValue="" />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-semibold">Email</label>
          <Input type="email" placeholder="founder@lumi.com" defaultValue="" />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-semibold">Password</label>
          <Input type="password" placeholder="••••••••" defaultValue="" />
          <p className="text-lumi-text-secondary text-sm">
            At least 1 uppercase, 1 lowercase, 1 number, 1 symbol.
          </p>
        </div>
        <label className="border-lumi-border/70 flex flex-row items-start gap-3 rounded-lg border p-3 text-sm">
          <input type="checkbox" />
          <span>
            I confirm that I have read and agree to the{" "}
            <a href="/terms" className="text-lumi-primary">
              terms & privacy policy
            </a>
            .
          </span>
        </label>
        <Button type="button" className="bg-lumi-primary hover:bg-lumi-primary-dark w-full">
          Create account
        </Button>
      </form>
      <p className="text-lumi-text-secondary text-center text-sm">
        Already using Lumi?{" "}
        <Link href="/login" className="text-lumi-primary hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
