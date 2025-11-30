"use client";

import { useEffect } from "react";

import { usePathname } from "next/navigation";

import { Button } from "@/components/ui/button";
import { captureException } from "@/lib/analytics/sentry";

interface GlobalErrorProps {
  error: Error;
  reset: () => void;
}

export default function GlobalError({ error, reset }: GlobalErrorProps): JSX.Element {
  const pathname = usePathname();

  useEffect(() => {
    console.error("Global Next.js error", error);
    captureException(error, {
      tags: { boundary: "global", route: pathname ?? "unknown" },
    });
  }, [error, pathname]);

  return (
    <html lang="en">
      <body className="bg-lumi-bg text-lumi-text flex min-h-screen flex-col items-center justify-center gap-4">
        <h1 className="text-3xl font-semibold">Critical error</h1>
        <p className="text-lumi-text-secondary text-sm">
          A fatal exception prevented Lumi from rendering. Please retry or contact support.
        </p>
        <Button onClick={() => reset()}>Reload application</Button>
      </body>
    </html>
  );
}
