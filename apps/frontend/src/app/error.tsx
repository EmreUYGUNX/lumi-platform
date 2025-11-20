"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";

interface RootErrorProps {
  error: Error;
  reset: () => void;
}

export default function RootError({ error, reset }: RootErrorProps): JSX.Element {
  useEffect(() => {
    console.error("Root segment error", error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 text-center">
      <h1 className="text-2xl font-semibold">An unexpected error occurred.</h1>
      <p className="text-lumi-text-secondary max-w-md text-sm">
        We couldn’t render this route. Retry the request or report the issue so our platform team
        can investigate.
      </p>
      <div className="flex gap-3">
        <Button onClick={() => reset()}>Try again</Button>
        <Button variant="outline" asChild>
          <a href="mailto:support@lumi.com">Report issue</a>
        </Button>
      </div>
    </div>
  );
}
