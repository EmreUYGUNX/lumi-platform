import { createCounter, createGauge, createHistogram } from "./metrics.js";

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

const uploadStatusCounter = createCounter({
  name: "media_uploads_total",
  help: "Counts media uploads grouped by status.",
  labelNames: ["status"],
});

const uploadDurationHistogram = createHistogram({
  name: "media_upload_duration_seconds",
  help: "Measures media upload processing duration segmented by folder.",
  buckets: [0.5, 1, 2, 3, 5, 8, 13, 21],
  labelNames: ["folder"],
});

const storageGauge = createGauge({
  name: "media_storage_bytes",
  help: "Tracks cumulative media storage written via the uploader (best-effort).",
  labelNames: ["folder"],
});

const cloudinaryErrorCounter = createCounter({
  name: "cloudinary_api_errors_total",
  help: "Counts Cloudinary API failures partitioned by operation.",
  labelNames: ["operation"],
});

const cloudinaryUsageGauge = createGauge({
  name: "cloudinary_usage_bytes",
  help: "Cloudinary usage snapshots segmented by resource and kind (usage vs limit).",
  labelNames: ["resource", "kind"],
});

const cloudinaryUsageRatioGauge = createGauge({
  name: "cloudinary_usage_ratio",
  help: "Cloudinary usage ratio (usage / limit) per resource.",
  labelNames: ["resource"],
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
  recordUploadStatus(status: "success" | "failure") {
    uploadStatusCounter.inc({ status });
  },
  observeUploadDuration(folder: string, durationMs: number) {
    const seconds = Math.max(0, durationMs / 1000);
    uploadDurationHistogram.observe(
      {
        folder: normaliseLabel(folder),
      },
      seconds,
    );
  },
  recordStorageBytes(folder: string, bytes: number) {
    storageGauge.labels(normaliseLabel(folder)).inc(Math.max(0, bytes));
  },
  recordCloudinaryError(operation: string) {
    cloudinaryErrorCounter.inc({
      operation: normaliseLabel(operation),
    });
  },
  recordCloudinaryUsage(resource: string, usageBytes: number, limitBytes?: number) {
    const resourceLabel = normaliseLabel(resource);
    cloudinaryUsageGauge.labels(resourceLabel, "usage").set(Math.max(0, usageBytes));
    if (typeof limitBytes === "number" && Number.isFinite(limitBytes) && limitBytes >= 0) {
      cloudinaryUsageGauge.labels(resourceLabel, "limit").set(limitBytes);
      if (limitBytes > 0) {
        const ratio = Math.max(0, Math.min(usageBytes / limitBytes, 1));
        cloudinaryUsageRatioGauge.labels(resourceLabel).set(ratio);
      }
    }
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
