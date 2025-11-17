/* istanbul ignore file -- runtime poller backed by external API */
import type { CloudinaryClient } from "@/integrations/cloudinary/cloudinary.client.js";
import { getCloudinaryClient } from "@/integrations/cloudinary/cloudinary.client.js";
import { createChildLogger } from "@/lib/logger.js";
import { sendAlert } from "@/observability/index.js";
import { mediaMetrics } from "@/observability/media-metrics.js";

interface MediaUsageMonitorOptions {
  client?: CloudinaryClient;
  pollIntervalMs?: number;
  alertThreshold?: number;
  logger?: ReturnType<typeof createChildLogger>;
}

const DEFAULT_ALERT_THRESHOLD = 0.8;
const DEFAULT_POLL_INTERVAL_MS = 15 * 60 * 1000;
const USAGE_ALERT_SOURCE = "media.cloudinary.usage";

export class MediaUsageMonitor {
  private readonly client: CloudinaryClient;

  private readonly pollIntervalMs: number;

  private readonly alertThreshold: number;

  private readonly logger: ReturnType<typeof createChildLogger>;

  private timer?: NodeJS.Timeout;

  private readonly lastAlertRatios = new Map<string, number>();

  constructor(options: MediaUsageMonitorOptions = {}) {
    this.client = options.client ?? getCloudinaryClient();
    this.pollIntervalMs = options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
    this.alertThreshold = options.alertThreshold ?? DEFAULT_ALERT_THRESHOLD;
    this.logger = options.logger ?? createChildLogger("media:cloudinary:usage");
  }

  start(): void {
    if (this.timer) {
      return;
    }

    this.logger.info("Starting Cloudinary usage monitor", {
      pollIntervalMs: this.pollIntervalMs,
      alertThreshold: this.alertThreshold,
    });

    const execute = () =>
      this.pollUsage()
        .catch((error) => {
          this.logger.warn("Cloudinary usage poll failed", { error });
        })
        .finally(() => {
          this.timer = setTimeout(execute, this.pollIntervalMs);
        });

    execute();
  }

  stop(): void {
    if (!this.timer) {
      return;
    }

    clearTimeout(this.timer);
    this.timer = undefined;
  }

  private async pollUsage(): Promise<void> {
    const summary = await this.client.getUsageSummary();
    this.logger.debug("Cloudinary usage snapshot", summary);

    const resources: {
      name: "storage" | "bandwidth" | "transformations";
      usage: number;
      limit?: number;
    }[] = [
      { name: "storage", usage: summary.storage.usage, limit: summary.storage.limit },
      { name: "bandwidth", usage: summary.bandwidth.usage, limit: summary.bandwidth.limit },
      {
        name: "transformations",
        usage: summary.transformations.usage,
        limit: summary.transformations.limit,
      },
    ];

    resources.forEach((resource) => {
      mediaMetrics.recordCloudinaryUsage(resource.name, resource.usage, resource.limit);

      if (!resource.limit || resource.limit <= 0) {
        return;
      }

      const ratio = resource.usage / resource.limit;
      if (ratio < this.alertThreshold) {
        return;
      }

      const previousRatio = this.lastAlertRatios.get(resource.name) ?? 0;
      if (ratio - previousRatio < 0.05 && ratio < 1) {
        return;
      }

      const severity = ratio >= 0.95 ? "error" : "warn";
      this.lastAlertRatios.set(resource.name, ratio);

      sendAlert({
        severity,
        source: USAGE_ALERT_SOURCE,
        message: `Cloudinary ${resource.name} usage exceeded ${Math.round(ratio * 100)}% of quota.`,
        details: {
          resource: resource.name,
          usage: resource.usage,
          limit: resource.limit,
          ratio,
        },
      }).catch((error) => {
        this.logger.warn("Failed to dispatch Cloudinary usage alert", {
          error,
          resource: resource.name,
        });
      });
    });
  }
}
