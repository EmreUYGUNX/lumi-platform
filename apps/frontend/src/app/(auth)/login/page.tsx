"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// Prevent Next from attempting to prerender this client page during build.
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function LoginPage(): JSX.Element {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Welcome back</h1>
        <p className="text-lumi-text-secondary text-sm">
          Access the dashboard to orchestrate your commerce stack.
        </p>
      </div>
      <form className="space-y-5">
        <div className="space-y-2">
          <label className="text-sm font-medium">Email</label>
          <Input type="email" placeholder="founder@lumi.com" defaultValue="" />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Password</label>
          <Input type="password" placeholder="••••••••" defaultValue="" />
        </div>
        <div className="flex items-center justify-between text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" />
            Remember this device
          </label>
          <Link href="/forgot-password" className="text-lumi-primary hover:underline">
            Forgot password?
          </Link>
        </div>
        <Button type="button" className="bg-lumi-primary hover:bg-lumi-primary-dark w-full">
          Sign in
        </Button>
      </form>
      <p className="text-lumi-text-secondary text-center text-sm">
        New to Lumi?{" "}
        <Link href="/register" className="text-lumi-primary hover:underline">
          Create an account
        </Link>
      </p>
    </div>
  );
}
