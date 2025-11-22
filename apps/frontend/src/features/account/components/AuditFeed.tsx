"use client";

import { useMemo, useState } from "react";

import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ActivityTimeline } from "@/components/ui/feedback/ActivityTimeline";

import type { ActivityItem } from "../types";

const auditEvents: ActivityItem[] = [
  {
    id: "a1",
    title: "Login success",
    description: "Chrome on macOS from Istanbul",
    timestamp: new Date().toISOString(),
    type: "login",
  },
  {
    id: "a2",
    title: "Profile updated",
    description: "Name and phone number changed",
    timestamp: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
    type: "profile",
  },
  {
    id: "a3",
    title: "Order placed",
    description: "Order #12345",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
    type: "order",
  },
];

export function AuditFeed(): JSX.Element {
  const [filter, setFilter] = useState<string>("all");

  const filtered = useMemo(() => {
    if (filter === "all") {
      return auditEvents;
    }
    return auditEvents.filter((event) => event.type === filter);
  }, [filter]);

  const exportCsv = () => {
    const header = "id,title,description,timestamp,type";
    const rows = filtered.map((item) =>
      [item.id, item.title, item.description, item.timestamp, item.type].join(","),
    );
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "audit-log.csv";
    link.click();
  };

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <CardTitle>Audit trail</CardTitle>
          <CardDescription>Track security events and account changes.</CardDescription>
        </div>
        <div className="flex gap-2">
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Filter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="login">Login</SelectItem>
              <SelectItem value="security">Security</SelectItem>
              <SelectItem value="profile">Profile</SelectItem>
              <SelectItem value="order">Order</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" className="gap-2" onClick={exportCsv}>
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
          <Button variant="outline" disabled>
            Export PDF (soon)
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <ActivityTimeline
          items={filtered.map((item) => ({
            ...item,
            variant: item.type === "security" ? "warning" : "default",
          }))}
        />
      </CardContent>
    </Card>
  );
}
