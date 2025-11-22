"use client";

import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";

export function NetworkStatus(): JSX.Element {
  const [online, setOnline] = useState<boolean>(
    typeof navigator === "undefined" ? true : navigator.onLine,
  );

  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  return (
    <Badge variant={online ? "outline" : "destructive"} aria-live="polite" className="gap-2">
      <span
        className="h-2 w-2 rounded-full"
        style={{ backgroundColor: online ? "#22c55e" : "#ef4444" }}
      />
      {online ? "Online" : "Offline"}
    </Badge>
  );
}
