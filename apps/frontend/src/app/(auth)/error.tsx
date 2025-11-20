"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";

interface AuthErrorProps {
  error: Error;
  reset: () => void;
}

export default function AuthError({ error, reset }: AuthErrorProps): JSX.Element {
  useEffect(() => {
    console.error("Auth route error", error);
  }, [error]);

  return (
    <div className="space-y-4 text-center">
      <h1 className="text-xl font-semibold">Authentication hiccup</h1>
      <p className="text-lumi-text-secondary text-sm">
        Session could not be validated. Please retry your request.
      </p>
      <div className="flex justify-center gap-3">
        <Button onClick={() => reset()}>Retry</Button>
        <Button variant="outline" asChild>
          <a href="mailto:support@lumi.com">Report issue</a>
        </Button>
      </div>
    </div>
  );
}
