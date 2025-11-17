/* istanbul ignore file -- BullMQ wiring relies on runtime queue orchestration and is validated via integration flows. */
import { URL } from "node:url";

import { type JobsOptions, Queue, QueueEvents, type QueueOptions, Worker } from "bullmq";

import { getConfig } from "@/config/index.js";
import type { MediaCleanupJobOptions, MediaCleanupJobResult } from "@/jobs/media-cleanup.job.js";
import { runMediaCleanupJob } from "@/jobs/media-cleanup.job.js";
import type {
  MediaTransformationJobOptions,
  MediaTransformationJobResult,
} from "@/jobs/media-transformation.job.js";
import { runMediaTransformationJob } from "@/jobs/media-transformation.job.js";
import { createChildLogger } from "@/lib/logger.js";
import { reportMediaWebhookFailure } from "@/modules/media/media.alerts.js";
import {
  type WebhookIdempotencyStore,
  createWebhookIdempotencyStore,
} from "@/webhooks/cloudinary.idempotency.js";
import { CloudinaryWebhookProcessor } from "@/webhooks/cloudinary.processor.js";
import type { CloudinaryWebhookEvent } from "@/webhooks/cloudinary.types.js";
import type { ApplicationConfig } from "@lumi/types";

const MEDIA_QUEUE_NAME = "media:tasks";
const WEBHOOK_JOB_NAME = "media:webhook-event";
const CLEANUP_JOB_NAME = "media:cleanup";
const TRANSFORMATION_JOB_NAME = "media:regenerate-transformations";
const CLEANUP_CRON_EXPRESSION = "0 2 * * *";
const TRANSFORMATION_CRON_EXPRESSION = "0 3 * * 0";
const DEFAULT_WEBHOOK_ATTEMPTS = 5;
const DEFAULT_WEBHOOK_BACKOFF_MS = 2000;

export interface MediaWebhookJobPayload {
  event: CloudinaryWebhookEvent;
}

export type MediaCleanupJobPayload = MediaCleanupJobOptions;

export type MediaTransformationJobPayload = MediaTransformationJobOptions;

type MediaQueueJobData =
  | MediaWebhookJobPayload
  | MediaCleanupJobPayload
  | MediaTransformationJobPayload;
type MediaQueueJobName =
  | typeof WEBHOOK_JOB_NAME
  | typeof CLEANUP_JOB_NAME
  | typeof TRANSFORMATION_JOB_NAME;

const buildRedisOptions = (redisUrl: string): QueueOptions["connection"] => {
  const url = new URL(redisUrl);
  const isSecure = url.protocol === "rediss:";
  const db =
    url.pathname && url.pathname !== "/" ? Number.parseInt(url.pathname.slice(1), 10) : undefined;

  return {
    host: url.hostname,
    port: Number.parseInt(url.port || "6379", 10),
    password: url.password || undefined,
    username: url.username || undefined,
    db: Number.isNaN(db) ? undefined : db,
    tls: isSecure ? {} : undefined,
    maxRetriesPerRequest: 2,
  };
};

export interface MediaQueueProcessorOptions {
  idempotencyStore?: WebhookIdempotencyStore;
  cloudinaryProcessor?: CloudinaryWebhookProcessor;
}

interface MediaQueueProcessor {
  handleWebhook(payload: MediaWebhookJobPayload, attemptsMade: number): Promise<void>;
  handleCleanup(payload: MediaCleanupJobPayload): Promise<MediaCleanupJobResult>;
  handleTransformation(
    payload: MediaTransformationJobPayload,
  ): Promise<MediaTransformationJobResult>;
  shutdown(): Promise<void>;
}

const createMediaQueueProcessor = (
  options: MediaQueueProcessorOptions = {},
): MediaQueueProcessor => {
  const cloudinaryProcessor = options.cloudinaryProcessor ?? new CloudinaryWebhookProcessor();
  const idempotencyStore =
    options.idempotencyStore ?? createWebhookIdempotencyStore({ driver: "redis" });
  const logger = createChildLogger("media:queue:processor");

  return {
    async handleWebhook(payload: MediaWebhookJobPayload, attemptsMade: number) {
      if (!payload?.event) {
        logger.warn("Webhook job missing payload");
        return;
      }

      const existing = await idempotencyStore.isDuplicate(payload.event.id);
      if (existing) {
        logger.info("Skipping duplicate Cloudinary webhook event", {
          eventId: payload.event.id,
        });
        return;
      }

      const enrichedEvent: CloudinaryWebhookEvent = {
        ...payload.event,
        attempt: attemptsMade + 1,
      };

      await cloudinaryProcessor.process(enrichedEvent);
      await idempotencyStore.remember(payload.event.id);
    },
    async handleCleanup(payload: MediaCleanupJobPayload) {
      logger.debug("Executing media cleanup job", { payload });
      return runMediaCleanupJob(payload);
    },
    async handleTransformation(payload: MediaTransformationJobPayload) {
      logger.debug("Executing media transformation regeneration job", { payload });
      return runMediaTransformationJob(payload);
    },
    async shutdown() {
      await idempotencyStore.shutdown();
    },
  };
};

const createWebhookJobOptions = (event: CloudinaryWebhookEvent): JobsOptions => ({
  jobId: event.id,
  attempts: DEFAULT_WEBHOOK_ATTEMPTS,
  removeOnComplete: 250,
  removeOnFail: 1000,
  backoff: {
    type: "exponential",
    delay: DEFAULT_WEBHOOK_BACKOFF_MS,
  },
});

const createCleanupJobOptions = (): JobsOptions => ({
  removeOnComplete: 50,
  removeOnFail: 100,
  jobId: "media:cleanup:adhoc",
});

const createTransformationJobOptions = (): JobsOptions => ({
  removeOnComplete: 10,
  removeOnFail: 50,
  jobId: "media:transformations:adhoc",
});

export interface MediaQueueController {
  enqueueWebhookEvent(payload: MediaWebhookJobPayload): Promise<{ jobId: string }>;
  scheduleDailyCleanup(): Promise<void>;
  scheduleWeeklyTransformationRegeneration(): Promise<void>;
  enqueueCleanupNow(payload?: MediaCleanupJobPayload): Promise<{ jobId: string }>;
  enqueueTransformationRegeneration(
    payload?: MediaTransformationJobPayload,
  ): Promise<{ jobId: string }>;
  shutdown(): Promise<void>;
}

interface BullMediaQueueControllerOptions {
  config: ApplicationConfig;
  processor?: MediaQueueProcessor;
}

class BullMediaQueueController implements MediaQueueController {
  private readonly queue: Queue<MediaQueueJobData, unknown, MediaQueueJobName>;

  private readonly worker: Worker<MediaQueueJobData, unknown, MediaQueueJobName>;

  private readonly events: QueueEvents;

  private readonly processor: MediaQueueProcessor;

  private readonly logger = createChildLogger("media:queue:bull");

  constructor(options: BullMediaQueueControllerOptions) {
    const connection = buildRedisOptions(options.config.cache.redisUrl);

    this.queue = new Queue<MediaQueueJobData, unknown, MediaQueueJobName>(MEDIA_QUEUE_NAME, {
      connection,
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 1000,
      },
    });
    this.events = new QueueEvents(MEDIA_QUEUE_NAME, { connection });
    this.processor =
      options.processor ??
      createMediaQueueProcessor({
        idempotencyStore: createWebhookIdempotencyStore({ driver: "redis" }),
      });

    this.worker = new Worker(
      MEDIA_QUEUE_NAME,
      async (job) => {
        switch (job.name) {
          case WEBHOOK_JOB_NAME: {
            await this.processor.handleWebhook(
              job.data as MediaWebhookJobPayload,
              job.attemptsMade,
            );
            break;
          }
          case CLEANUP_JOB_NAME: {
            await this.processor.handleCleanup(job.data as MediaCleanupJobPayload);
            break;
          }
          case TRANSFORMATION_JOB_NAME: {
            await this.processor.handleTransformation(job.data as MediaTransformationJobPayload);
            break;
          }
          default: {
            this.logger.warn("Received unsupported media queue job", { jobName: job.name });
          }
        }
      },
      {
        connection,
        concurrency: 5,
      },
    );

    this.worker.on("failed", (job, error) => {
      this.logger.error("Media queue job failed", {
        jobId: job?.id,
        name: job?.name,
        attemptsMade: job?.attemptsMade,
        error,
      });
      if (job?.name === WEBHOOK_JOB_NAME) {
        const payload = (job.data as MediaWebhookJobPayload | undefined)?.event;
        reportMediaWebhookFailure({
          jobId: job.id ? String(job.id) : undefined,
          eventId: payload?.id,
          eventType: payload?.type,
          attempt: job.attemptsMade,
          errorMessage: error instanceof Error ? error.message : undefined,
        });
      }
    });

    this.events.on("completed", (data) => {
      this.logger.debug("Media queue job completed", data);
    });
  }

  async enqueueWebhookEvent(payload: MediaWebhookJobPayload): Promise<{ jobId: string }> {
    const job = await this.queue.add(
      WEBHOOK_JOB_NAME,
      payload,
      createWebhookJobOptions(payload.event),
    );
    this.logger.info("Enqueued Cloudinary webhook job", {
      jobId: job.id,
      publicId: payload.event.payload.public_id,
    });
    return { jobId: job.id as string };
  }

  async enqueueCleanupNow(payload: MediaCleanupJobPayload = {}): Promise<{ jobId: string }> {
    const job = await this.queue.add(CLEANUP_JOB_NAME, payload, createCleanupJobOptions());
    return { jobId: job.id as string };
  }

  async enqueueTransformationRegeneration(
    payload: MediaTransformationJobPayload = {},
  ): Promise<{ jobId: string }> {
    const job = await this.queue.add(
      TRANSFORMATION_JOB_NAME,
      payload,
      createTransformationJobOptions(),
    );
    return { jobId: job.id as string };
  }

  async scheduleDailyCleanup(): Promise<void> {
    await this.queue.add(
      CLEANUP_JOB_NAME,
      {},
      {
        repeat: {
          pattern: CLEANUP_CRON_EXPRESSION,
          tz: "UTC",
        },
        jobId: "media:cleanup:daily",
        removeOnComplete: true,
      },
    );
  }

  async scheduleWeeklyTransformationRegeneration(): Promise<void> {
    await this.queue.add(
      TRANSFORMATION_JOB_NAME,
      {},
      {
        repeat: {
          pattern: TRANSFORMATION_CRON_EXPRESSION,
          tz: "UTC",
        },
        jobId: "media:transformations:weekly",
        removeOnComplete: true,
      },
    );
  }

  async shutdown(): Promise<void> {
    await Promise.allSettled([
      this.worker.close(),
      this.queue.close(),
      this.events.close(),
      this.processor.shutdown(),
    ]);
  }
}

const createInMemoryMediaQueueController = (
  options: MediaQueueProcessorOptions = {},
): MediaQueueController => {
  const processor = createMediaQueueProcessor({
    idempotencyStore:
      options.idempotencyStore ??
      createWebhookIdempotencyStore({
        driver: "memory",
      }),
    cloudinaryProcessor: options.cloudinaryProcessor,
  });
  const logger = createChildLogger("media:queue:memory");
  let pending: Promise<void> = Promise.resolve();

  const enqueue = <T>(task: () => Promise<T>): Promise<T> => {
    const run = pending.then(() => task());
    pending = (async () => {
      try {
        await run;
      } catch (error) {
        logger.error("In-memory media queue task failed", { error });
      }
    })();
    return run;
  };

  return {
    async enqueueWebhookEvent(payload: MediaWebhookJobPayload) {
      await enqueue(() => processor.handleWebhook(payload, 0));
      return { jobId: payload.event.id };
    },
    async enqueueCleanupNow(payload: MediaCleanupJobPayload = {}) {
      await enqueue(() => processor.handleCleanup(payload));
      return { jobId: "memory:cleanup" };
    },
    async enqueueTransformationRegeneration(payload: MediaTransformationJobPayload = {}) {
      await enqueue(() => processor.handleTransformation(payload));
      return { jobId: "memory:transformations" };
    },
    async scheduleDailyCleanup() {
      // No-op for in-memory controller; tests trigger manually.
    },
    async scheduleWeeklyTransformationRegeneration() {
      // No-op for in-memory controller.
    },
    async shutdown() {
      await processor.shutdown();
    },
  };
};

export interface CreateMediaQueueOptions {
  config: ApplicationConfig;
  driver?: "bullmq" | "memory";
}

export const createMediaQueueController = ({
  config,
  driver,
}: CreateMediaQueueOptions): MediaQueueController => {
  const resolvedDriver =
    driver ?? (config.app.environment === "test" || config.runtime.ci ? "memory" : "bullmq");

  if (resolvedDriver === "memory") {
    return createInMemoryMediaQueueController();
  }

  return new BullMediaQueueController({ config });
};

let sharedMediaQueue: MediaQueueController | undefined;

export const getMediaQueueController = (config?: ApplicationConfig): MediaQueueController => {
  if (!sharedMediaQueue) {
    sharedMediaQueue = createMediaQueueController({
      config: config ?? getConfig(),
    });
  }

  return sharedMediaQueue;
};

export const shutdownMediaQueue = async (): Promise<void> => {
  if (!sharedMediaQueue) {
    return;
  }

  await sharedMediaQueue.shutdown();
  sharedMediaQueue = undefined;
};

export const mediaQueueConstants = {
  MEDIA_QUEUE_NAME,
  WEBHOOK_JOB_NAME,
  CLEANUP_JOB_NAME,
  TRANSFORMATION_JOB_NAME,
  CLEANUP_CRON_EXPRESSION,
  TRANSFORMATION_CRON_EXPRESSION,
};
