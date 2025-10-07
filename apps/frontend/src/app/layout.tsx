import type { Metadata } from "next";
import type { PropsWithChildren } from "react";

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
