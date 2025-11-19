import { Button } from "@/components/ui/button";

import { AuditLogButton } from "./AuditLogButton";

export function AdminTopbar(): JSX.Element {
  return (
    <div className="border-lumi-border/60 bg-lumi-bg flex items-center justify-between border-b px-6 py-4">
      <div>
        <p className="text-lumi-text-secondary text-xs uppercase tracking-[0.3em]">Administrator</p>
        <h2 className="text-lg font-semibold">Platform control center</h2>
      </div>
      <div className="flex items-center gap-3">
        <Button variant="outline">System status</Button>
        <AuditLogButton />
      </div>
    </div>
  );
}
