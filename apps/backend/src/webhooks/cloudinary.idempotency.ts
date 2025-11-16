import { createChildLogger } from "@/lib/logger.js";
import { type RedisClientInstance, createRedisClient } from "@/lib/redis.js";

const DEFAULT_IDEMPOTENCY_WINDOW_SECONDS = 24 * 60 * 60;

export interface WebhookIdempotencyStore {
  isDuplicate(eventId: string): Promise<boolean>;
  remember(eventId: string, ttlSeconds?: number): Promise<void>;
  shutdown(): Promise<void>;
}

export interface CreateWebhookIdempotencyStoreOptions {
  driver?: "redis" | "memory";
}

const buildRedisKey = (eventId: string) => `media:webhooks:idempotency:${eventId}`;

const createMemoryStore = (): WebhookIdempotencyStore => {
  const cache = new Map<string, number>();

  const purgeExpired = () => {
    const now = Date.now();
    cache.forEach((expiresAt, key) => {
      if (expiresAt <= now) {
        cache.delete(key);
      }
    });
  };

  return {
    async isDuplicate(eventId: string) {
      purgeExpired();
      return cache.has(eventId);
    },
    async remember(eventId: string, ttlSeconds = DEFAULT_IDEMPOTENCY_WINDOW_SECONDS) {
      cache.set(eventId, Date.now() + ttlSeconds * 1000);
    },
    async shutdown() {
      cache.clear();
    },
  };
};

const createRedisStore = (): WebhookIdempotencyStore => {
  const client: RedisClientInstance = createRedisClient({ name: "media-webhook-idempotency" });
  const logger = createChildLogger("media:webhook:idempotency");
  const fallback = createMemoryStore();
  let connected = false;
  let connectionFailed = false;

  const ensureConnected = async () => {
    if (connectionFailed) {
      return false;
    }

    if (connected) {
      return true;
    }

    try {
      await client.connect();
      connected = true;
      return true;
    } catch (error) {
      connectionFailed = true;
      logger.error("Failed to connect to Redis idempotency store", { error });
      return false;
    }
  };

  const executeWithFallback = async <T>(
    operation: () => Promise<T>,
    fallbackTask: () => Promise<T>,
  ) => {
    const isConnected = await ensureConnected();
    if (!isConnected) {
      return fallbackTask();
    }

    try {
      return await operation();
    } catch (error) {
      logger.error("Redis idempotency operation failed", { error });
      connectionFailed = true;
      return fallbackTask();
    }
  };

  return {
    async isDuplicate(eventId: string) {
      return executeWithFallback(
        async () => {
          const exists = await client.exists(buildRedisKey(eventId));
          return exists > 0;
        },
        () => fallback.isDuplicate(eventId),
      );
    },
    async remember(eventId: string, ttlSeconds = DEFAULT_IDEMPOTENCY_WINDOW_SECONDS) {
      await executeWithFallback(
        async () => {
          await client.set(buildRedisKey(eventId), "1", {
            EX: ttlSeconds,
          });
        },
        () => fallback.remember(eventId, ttlSeconds),
      );
    },
    async shutdown() {
      if (connected) {
        await client.disconnect();
      }

      await fallback.shutdown();
    },
  };
};

export const createWebhookIdempotencyStore = (
  options: CreateWebhookIdempotencyStoreOptions = {},
): WebhookIdempotencyStore => {
  if (options.driver === "memory") {
    return createMemoryStore();
  }

  return createRedisStore();
};
