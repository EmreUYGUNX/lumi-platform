import type { PropsWithChildren } from "react";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Lumi Frontend",
  description: "Placeholder interface for the Lumi commerce platform.",
};

export default function RootLayout({ children }: PropsWithChildren): JSX.Element {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
