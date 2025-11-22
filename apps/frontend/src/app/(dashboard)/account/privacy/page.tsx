"use client";

import { AuditFeed } from "@/features/account/components/AuditFeed";
import { ConsentCenter } from "@/features/account/components/ConsentCenter";

export default function PrivacyPage(): JSX.Element {
  return (
    <div className="space-y-6">
      <ConsentCenter />
      <AuditFeed />
    </div>
  );
}
