"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NetworkStatus } from "@/components/ui/feedback/NetworkStatus";

export default function OfflinePage(): JSX.Element {
  const [cachedContent] = useState<string>("Önbelleğe alınan içerik bulunamadı.");

  useEffect(() => {
    const onOnline = () => {
      window.location.href = "/";
    };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, []);

  return (
    <div className="bg-lumi-bg flex min-h-screen items-center justify-center px-4">
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle>Çevrimdışısın</CardTitle>
          <CardDescription>İnternet bağlantını kontrol et ve tekrar dene.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <NetworkStatus />
          <div className="bg-lumi-bg-secondary/50 text-lumi-text-secondary rounded-lg p-3 text-sm">
            {cachedContent}
          </div>
          <Button className="w-full" onClick={() => window.location.reload()}>
            Yeniden dene
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
