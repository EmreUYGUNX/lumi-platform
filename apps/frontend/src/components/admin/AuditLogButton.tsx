"use client";

import { Radar } from "lucide-react";

import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

export function AuditLogButton(): JSX.Element {
  return (
    <Button
      type="button"
      className="bg-lumi-primary hover:bg-lumi-primary-dark"
      onClick={() =>
        toast({
          title: "Audit log trigger",
          description: "Phase 7-8 connects this button to the monitoring service.",
        })
      }
    >
      <Radar className="mr-2 h-4 w-4" />
      Trigger audit log
    </Button>
  );
}
