import { createCounter, createHistogram } from "./metrics.js";

const uploadFormatCounter = createCounter({
  name: "media_upload_format_total",
  help: "Counts media uploads grouped by original asset format.",
  labelNames: ["format"],
});

const cdnPrefetchCounter = createCounter({
  name: "media_cdn_prefetch_total",
  help: "Tracks CDN cache prefetch attempts segmented by status.",
  labelNames: ["status"],
});

const lcpHistogram = createHistogram({
  name: "media_lcp_seconds",
  help: "Largest Contentful Paint metrics reported by client applications.",
  buckets: [0.5, 0.75, 1, 1.2, 1.5, 2, 3],
  labelNames: ["route"],
});

const normaliseLabel = (value?: string | null): string => {
  if (!value) {
    return "unknown";
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : "unknown";
};

export const mediaMetrics = {
  recordUploadFormat(format?: string | null) {
    uploadFormatCounter.inc({
      format: normaliseLabel(format?.toLowerCase()),
    });
  },
  recordCdnPrefetch(status: "hit" | "miss" | "error" | "unknown") {
    cdnPrefetchCounter.inc({ status });
  },
  recordLcp(valueMs: number, route?: string) {
    const seconds = Math.max(0, valueMs / 1000);
    lcpHistogram.observe(
      {
        route: normaliseLabel(route),
      },
      seconds,
    );
  },
};
