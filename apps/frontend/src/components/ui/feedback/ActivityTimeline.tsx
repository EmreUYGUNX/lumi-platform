"use client";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type TimelineVariant = "default" | "info" | "warning";

export interface ActivityTimelineItem {
  id: string;
  title: string;
  description?: string;
  timestamp: string;
  variant?: TimelineVariant;
}

interface ActivityTimelineProps {
  items: ActivityTimelineItem[];
}

const variantClasses: Record<TimelineVariant, string> = {
  default: "bg-lumi-primary",
  info: "bg-lumi-primary",
  warning: "bg-lumi-warning",
};

export function ActivityTimeline({ items }: ActivityTimelineProps): JSX.Element {
  return (
    <div className="space-y-4">
      {items.map((item) => (
        <div key={item.id} className="flex gap-3">
          <span
            className={cn("mt-1 h-2 w-2 rounded-full", variantClasses[item.variant ?? "default"])}
            aria-hidden
          />
          <div className="flex-1 space-y-1">
            <div className="flex items-center justify-between">
              <p className="font-semibold">{item.title}</p>
              <Badge variant="outline" className="text-xs">
                {new Date(item.timestamp).toLocaleString()}
              </Badge>
            </div>
            {item.description && (
              <Card className="bg-lumi-bg-secondary/50 text-lumi-text-secondary px-3 py-2 text-sm">
                {item.description}
              </Card>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
