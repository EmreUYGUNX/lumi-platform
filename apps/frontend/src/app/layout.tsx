import type { PropsWithChildren } from "react";

import type { Metadata } from "next";

import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { ThemeProvider } from "@/providers/ThemeProvider";

import "./globals.css";

export const metadata: Metadata = {
  title: "Lumi Commerce Experience",
  description: "Next.js foundation for the Lumi commerce platform.",
};

export default function RootLayout({ children }: PropsWithChildren): JSX.Element {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-lumi-background text-lumi-text min-h-screen font-sans antialiased">
        <ThemeProvider>
          <div className="bg-lumi-background text-lumi-text relative flex min-h-screen flex-col">
            <ThemeToggle className="fixed bottom-6 right-6 z-50" />
            {children}
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
