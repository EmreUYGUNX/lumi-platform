"use client";

import { memo, useCallback, useMemo } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface CoveragePoint {
  id: string;
  label: string;
  latency: number;
  uptime: number;
  left: string;
  top: string;
}

const coveragePoints: CoveragePoint[] = [
  { id: "tr", label: "Istanbul", latency: 82, uptime: 99.99, left: "36%", top: "42%" },
  { id: "eu", label: "Frankfurt", latency: 54, uptime: 99.98, left: "44%", top: "34%" },
  { id: "us", label: "Virginia", latency: 96, uptime: 99.95, left: "24%", top: "42%" },
  { id: "asia", label: "Singapore", latency: 114, uptime: 99.96, left: "72%", top: "56%" },
];

const MapPoint = memo(({ point }: { point: CoveragePoint }) => (
  <div
    key={point.id}
    className="absolute -translate-x-1/2 -translate-y-1/2"
    style={{ left: point.left, top: point.top }}
  >
    <span className="bg-lumi-bg text-lumi-text-secondary ring-lumi-border/70 shadow-glow inline-flex min-w-[120px] items-center justify-between gap-2 rounded-full px-3 py-2 text-xs font-semibold ring-1">
      <span className="flex items-center gap-2">
        <span className="bg-lumi-success h-2.5 w-2.5 rounded-full" aria-hidden />
        {point.label}
      </span>
      <span>{point.latency} ms</span>
    </span>
  </div>
));
MapPoint.displayName = "MapPoint";

export default function MapCoveragePanel(): JSX.Element {
  const uptimeSummary = useMemo(() => {
    let best = 0;
    let total = 0;

    coveragePoints.forEach((point) => {
      best = Math.max(best, point.uptime);
      total += point.uptime;
    });

    const average = coveragePoints.length > 0 ? total / coveragePoints.length : 0;
    return { best, average: Number(average.toFixed(3)) };
  }, []);

  const formatUptime = useCallback((value: number) => `${value.toFixed(2)}%`, []);

  return (
    <Card className="border-lumi-border/70">
      <CardHeader className="space-y-1">
        <CardTitle>Edge map coverage</CardTitle>
        <CardDescription>
          Map widgets stay client-only and code-split, preventing geospatial helpers from inflating
          the critical path.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="border-lumi-border/70 from-lumi-primary/10 via-lumi-bg to-lumi-secondary/10 relative h-64 overflow-hidden rounded-2xl border bg-gradient-to-br">
          <div className="absolute inset-0 opacity-20 [background-image:radial-gradient(circle_at_1px,rgba(255,255,255,0.8)_1px,transparent_0)] [background-size:28px_28px]" />
          <div className="absolute inset-0">
            {coveragePoints.map((point) => (
              <MapPoint key={point.id} point={point} />
            ))}
          </div>
          <div className="border-lumi-border/60 bg-lumi-bg-secondary text-lumi-text-secondary absolute bottom-3 right-3 rounded-xl border px-3 py-2 text-[11px] font-semibold shadow-sm">
            {coveragePoints.length} regions · Best {formatUptime(uptimeSummary.best)} · Avg{" "}
            {formatUptime(uptimeSummary.average)}
          </div>
        </div>
        <p className="text-lumi-text-secondary text-sm leading-relaxed">
          Latency and uptime data is memoized to avoid re-renders while the widget animates on the
          client. When paired with <code>next/dynamic</code>, the map bundle downloads only after
          the dashboard shell becomes interactive.
        </p>
      </CardContent>
    </Card>
  );
}
