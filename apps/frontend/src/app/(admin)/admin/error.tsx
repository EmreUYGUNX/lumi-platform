"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";

interface AdminErrorProps {
  error: Error;
  reset: () => void;
}

export default function AdminError({ error, reset }: AdminErrorProps): JSX.Element {
  useEffect(() => {
    console.error("Admin route error", error);
  }, [error]);

  return (
    <div className="border-lumi-error/30 bg-lumi-error/5 rounded-3xl border p-6 text-center">
      <h1 className="text-lumi-error text-xl font-semibold">Admin action failed.</h1>
      <p className="text-lumi-text-secondary text-sm">
        Please retry or export audit logs for assistance.
      </p>
      <div className="mt-4 flex justify-center gap-3">
        <Button onClick={() => reset()}>Retry</Button>
        <Button variant="outline">Export audit log</Button>
      </div>
    </div>
  );
}
