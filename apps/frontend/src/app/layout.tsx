import type { PropsWithChildren } from "react";

import { MotionConfig } from "framer-motion";
import type { Metadata, Viewport } from "next";

import { Inter } from "next/font/google";

import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryProvider } from "@/providers/QueryProvider";
import { ThemeProvider } from "@/providers/ThemeProvider";

import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--lumi-font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Lumi Commerce Experience",
  description: "Next.js foundation for the Lumi commerce platform.",
  applicationName: "Lumi Commerce",
  authors: [{ name: "Lumi Platform" }],
  metadataBase: new URL("https://lumi-commerce.dev"),
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#3B82F6",
};

export default function RootLayout({ children }: PropsWithChildren): JSX.Element {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${inter.variable} bg-lumi-background text-lumi-text min-h-screen font-sans antialiased`}
      >
        <ThemeProvider>
          <QueryProvider>
            <MotionConfig
              reducedMotion="user"
              transition={{
                duration: 0.45,
                ease: [0.4, 0, 0.2, 1],
              }}
            >
              <TooltipProvider delayDuration={150}>
                <div className="bg-lumi-background text-lumi-text relative flex min-h-screen flex-col">
                  <ThemeToggle className="fixed bottom-6 right-6 z-50" />
                  {children}
                </div>
                <Toaster />
              </TooltipProvider>
            </MotionConfig>
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
