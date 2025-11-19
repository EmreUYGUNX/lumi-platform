"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";

interface DashboardErrorProps {
  error: Error;
  reset: () => void;
}

export default function DashboardError({ error, reset }: DashboardErrorProps): JSX.Element {
  useEffect(() => {
    console.error("Dashboard error boundary", error);
  }, [error]);

  return (
    <div className="border-lumi-error/30 bg-lumi-error/5 rounded-3xl border p-6 text-center">
      <h1 className="text-lumi-error text-xl font-semibold">Dashboard failed to load.</h1>
      <p className="text-lumi-text-secondary text-sm">
        We were unable to fetch data from the API. Try again or contact support.
      </p>
      <div className="mt-4 flex justify-center gap-3">
        <Button onClick={() => reset()}>Retry</Button>
        <Button variant="outline" asChild>
          <a href="mailto:support@lumi.com">Contact Support</a>
        </Button>
      </div>
    </div>
  );
}
