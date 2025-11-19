"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";

interface PublicErrorProps {
  error: Error;
  reset: () => void;
}

export default function PublicError({ error, reset }: PublicErrorProps): JSX.Element {
  useEffect(() => {
    console.error("Public route error", error);
  }, [error]);

  return (
    <div className="container flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <h1 className="text-3xl font-semibold">Something went sideways.</h1>
      <p className="text-lumi-text-secondary">We logged the issue and are investigating.</p>
      <div className="flex gap-3">
        <Button onClick={() => reset()}>Try again</Button>
        <Button variant="outline" asChild>
          <a href="mailto:support@lumi.com">Contact support</a>
        </Button>
      </div>
    </div>
  );
}
