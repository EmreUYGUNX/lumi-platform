import type { ReactNode } from "react";

import { serializeJsonForScript } from "@/lib/serialize-json";

interface MarketingWrapperProps {
  children: ReactNode;
  campaign?: string;
}

export function MarketingWrapper({
  children,
  campaign = "public-web",
}: MarketingWrapperProps): JSX.Element {
  const marketingConfig = {
    channel: campaign,
    cohort: "phase-6-foundation",
  };

  return (
    <div data-marketing-channel={marketingConfig.channel}>
      <script
        dangerouslySetInnerHTML={{
          __html: `window.dataLayer = window.dataLayer || []; window.dataLayer.push(${serializeJsonForScript(
            marketingConfig,
          )});`,
        }}
      />
      {children}
    </div>
  );
}
