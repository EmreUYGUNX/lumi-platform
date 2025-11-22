"use client";

import { memo, useCallback, useMemo } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

interface SeriesPoint {
  label: string;
  value: number;
  delta: number;
}

const rawSeries: SeriesPoint[] = [
  { label: "Conversion", value: 4.8, delta: 0.6 },
  { label: "AOV", value: 182, delta: 8 },
  { label: "Repeat rate", value: 36, delta: 4 },
  { label: "Refund rate", value: 1.4, delta: -0.2 },
];

const sparklineValues = [12, 18, 16, 22, 28, 30, 33, 40, 44, 48];

const ChartBar = memo(
  ({ label, value, max, delta }: { label: string; value: number; max: number; delta: number }) => {
    const width = Math.max(6, Math.round((value / max) * 100));
    const isPositive = delta >= 0;

    return (
      <div className="space-y-2" key={label}>
        <div className="text-lumi-text-secondary flex items-center justify-between text-sm">
          <span>{label}</span>
          <span className={isPositive ? "text-lumi-success" : "text-lumi-error"}>
            {isPositive ? "+" : ""}
            {delta.toFixed(1)}%
          </span>
        </div>
        <div className="bg-lumi-bg-secondary/80 h-3 rounded-full">
          <div
            className="from-lumi-primary to-lumi-secondary h-3 rounded-full bg-gradient-to-r transition-all"
            style={{ width: `${width}%` }}
            aria-label={`${label} ${value}%`}
          />
        </div>
      </div>
    );
  },
);
ChartBar.displayName = "ChartBar";

const Sparkline = memo(({ values }: { values: number[] }) => {
  const normalized = useMemo(() => {
    const max = Math.max(...values, 1);
    return values.map((value) => Math.round((value / max) * 80));
  }, [values]);

  return (
    <div className="border-lumi-border/60 bg-lumi-bg-secondary/70 relative h-20 overflow-hidden rounded-2xl border">
      <div className="from-lumi-primary/5 via-lumi-accent/5 absolute inset-0 bg-gradient-to-br to-transparent" />
      <svg className="absolute inset-2 h-[calc(100%-16px)] w-[calc(100%-16px)]" role="presentation">
        <polyline
          fill="url(#sparkfill)"
          stroke="url(#sparkstroke)"
          strokeWidth="2"
          points={normalized.map((y, index) => `${index * 18},${90 - y}`).join(" ")}
        />
        <defs>
          <linearGradient id="sparkstroke" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="var(--lumi-primary)" stopOpacity="0.9" />
            <stop offset="100%" stopColor="var(--lumi-secondary)" stopOpacity="0.9" />
          </linearGradient>
          <linearGradient id="sparkfill" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="var(--lumi-primary)" stopOpacity="0.12" />
            <stop offset="100%" stopColor="var(--lumi-bg)" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex items-end gap-2 px-4 pb-3">
        {normalized.map((normalizedValue, index) => (
          <div
            key={`${normalizedValue}-${index.toString()}`}
            className="from-lumi-primary/40 to-lumi-secondary/40 bg-gradient-to-t"
            style={{ height: `${Math.max(8, normalizedValue / 1.1)}%`, width: "12%" }}
          />
        ))}
      </div>
    </div>
  );
});
Sparkline.displayName = "Sparkline";

export default function AdminChartsPanel(): JSX.Element {
  const chartSeries = useMemo(() => rawSeries, []);
  const maxValue = useMemo(
    () => Math.max(1, ...chartSeries.map((entry) => entry.value)),
    [chartSeries],
  );

  const formatValue = useCallback((value: number) => `${value.toFixed(1)}%`, []);

  return (
    <Card className="border-lumi-border/70">
      <CardHeader className="space-y-1">
        <CardTitle>Admin dashboard charts</CardTitle>
        <CardDescription>
          Split out of the main bundle with <code>next/dynamic</code> to keep above-fold payloads
          lean while admin data hydrates.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          {chartSeries.map((item) => (
            <div key={item.label} className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <p className="text-lumi-text-secondary uppercase tracking-[0.2em]">{item.label}</p>
                <p className="text-lumi-text font-semibold">{formatValue(item.value)}</p>
              </div>
              <ChartBar label={item.label} value={item.value} max={maxValue} delta={item.delta} />
            </div>
          ))}
        </div>
        <Separator className="bg-lumi-border/70" />
        <div className="grid gap-4 lg:grid-cols-[1.2fr_minmax(0,1fr)]">
          <div className="space-y-2">
            <p className="text-lumi-text-secondary text-sm uppercase tracking-[0.2em]">
              Weekly GMV sparkline
            </p>
            <Sparkline values={sparklineValues} />
          </div>
          <div className="border-lumi-border/70 space-y-2 rounded-2xl border border-dashed p-4">
            <p className="text-lumi-text font-semibold">Performance notes</p>
            <p className="text-lumi-text-secondary text-sm leading-relaxed">
              Charts, rich editors, and map widgets are deferred with <code>dynamic()</code>,
              keeping the initial app shell under the 180KB target. Prefetching happens on hover for
              faster follow-up interactions.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
