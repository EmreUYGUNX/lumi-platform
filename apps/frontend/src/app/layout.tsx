/* eslint-disable import/order */

import type { PropsWithChildren } from "react";
import type { Metadata, Viewport } from "next";

import { GoogleAnalytics } from "@next/third-parties/google";
import { MotionConfig } from "framer-motion";
import { Inter } from "next/font/google";
import { Suspense } from "react";

import { NetworkStatus } from "@/components/ui/feedback/NetworkStatus";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AnalyticsProvider } from "@/providers/AnalyticsProvider";
import { QueryProvider } from "@/providers/QueryProvider";
import { SessionProvider } from "@/providers/SessionProvider";
import { ThemeProvider } from "@/providers/ThemeProvider";
import { env } from "@/lib/env";

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
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/icons/icon-192x192.png", sizes: "192x192" },
      { url: "/icons/icon-512x512.png", sizes: "512x512" },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Lumi Commerce",
  },
  themeColor: "#3B82F6",
  metadataBase: new URL(env.NEXT_PUBLIC_SITE_URL),
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
        {env.NEXT_PUBLIC_GA4_MEASUREMENT_ID && (
          <GoogleAnalytics gaId={env.NEXT_PUBLIC_GA4_MEASUREMENT_ID} />
        )}
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
                  <SessionProvider>
                    <Suspense fallback={undefined}>
                      <AnalyticsProvider />
                    </Suspense>
                    <a
                      href="#main-content"
                      className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:rounded-md focus:bg-white focus:px-3 focus:py-2 focus:text-black"
                    >
                      Skip to content
                    </a>
                    <div className="fixed left-4 top-4 z-50">
                      <NetworkStatus />
                    </div>
                    <ThemeToggle className="fixed bottom-6 right-6 z-50" />
                    {children}
                  </SessionProvider>
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
