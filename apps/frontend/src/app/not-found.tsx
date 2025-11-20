import type { Route } from "next";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function NotFound(): JSX.Element {
  const homeRoute = "/" as Route;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 text-center">
      <div className="space-y-3">
        <p className="text-lumi-text-secondary text-sm uppercase tracking-[0.3em]">404</p>
        <h1 className="text-3xl font-semibold">We couldn't find that view.</h1>
        <p className="text-lumi-text-secondary">
          Explore the popular links below or head back to the experience homepage.
        </p>
      </div>
      <form
        role="search"
        action="/"
        method="get"
        className="bg-lumi-bg-secondary/70 border-lumi-border/60 flex w-full max-w-md flex-col gap-3 rounded-2xl border p-4 sm:flex-row"
      >
        <Input
          type="search"
          name="q"
          aria-label="Search Lumi"
          placeholder="Search features, docs, or help"
          className="flex-1"
          required
        />
        <Button
          type="submit"
          className="bg-lumi-primary hover:bg-lumi-primary-dark w-full sm:w-auto"
        >
          Search Lumi
        </Button>
      </form>
      <div className="flex flex-wrap justify-center gap-3 text-sm">
        <Link href={homeRoute} className="text-lumi-primary hover:underline">
          Home
        </Link>
        <Link href={{ pathname: "/dashboard" }} className="text-lumi-primary hover:underline">
          Dashboard
        </Link>
        <Link href={{ pathname: "/admin" }} className="text-lumi-primary hover:underline">
          Admin
        </Link>
      </div>
      <Button asChild>
        <Link href={homeRoute}>Return home</Link>
      </Button>
    </div>
  );
}
