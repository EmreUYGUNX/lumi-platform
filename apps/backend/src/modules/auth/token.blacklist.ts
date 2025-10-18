import { setTimeout } from "node:timers/promises";

import { createClient } from "redis";

import { getConfig } from "@/config/index.js";
import { type LogMetadata, createChildLogger } from "@/lib/logger.js";

export interface TokenBlacklist {
  add(jti: string, expiresAt: Date): Promise<void>;
  has(jti: string): Promise<boolean>;
  remove(jti: string): Promise<void>;
  cleanup(): Promise<void>;
  shutdown(): Promise<void>;
}

const KEY_PREFIX = "auth:token:blacklist";
const DEFAULT_RETRY_DELAY_MS = 250;
const MAX_RETRY_ATTEMPTS = 3;

const toTtlSeconds = (expiresAt: Date): number => {
  const now = Date.now();
  const diffMs = expiresAt.getTime() - now;
  if (!Number.isFinite(diffMs) || diffMs <= 0) {
    return 1;
  }

  return Math.max(1, Math.ceil(diffMs / 1000));
};

const buildKey = (jti: string) => `${KEY_PREFIX}:${jti}`;

type RedisClientInstance = ReturnType<typeof createClient>;

const executeWithRetry = async <T>(operation: () => Promise<T>): Promise<T> => {
  let attempt = 0;
  let lastError: unknown;

  while (attempt < MAX_RETRY_ATTEMPTS) {
    attempt += 1;
    try {
      // eslint-disable-next-line no-await-in-loop -- sequential retry ensures deterministic behaviour
      return await operation();
    } catch (error) {
      lastError = error;
      // eslint-disable-next-line no-await-in-loop -- backoff between retries
      await setTimeout(DEFAULT_RETRY_DELAY_MS);
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Redis operation failed");
};

const createRedisTokenBlacklist = (
  client: RedisClientInstance,
  metadata: LogMetadata = {},
): TokenBlacklist => {
  const logger = createChildLogger("auth:token:blacklist:redis");
  let isConnected = false;

  const ensureConnected = async () => {
    if (isConnected || client.isOpen) {
      isConnected = true;
      return;
    }

    await client.connect();
    isConnected = true;
  };

  return {
    async add(jti: string, expiresAt: Date) {
      await ensureConnected();
      const ttlSeconds = toTtlSeconds(expiresAt);
      await executeWithRetry(() => client.set(buildKey(jti), "1", { EX: ttlSeconds }));
    },
    async has(jti: string) {
      await ensureConnected();
      const exists = await executeWithRetry(() => client.exists(buildKey(jti)));
      return exists === 1;
    },
    async remove(jti: string) {
      await ensureConnected();
      await executeWithRetry(() => client.del(buildKey(jti)));
    },
    async cleanup() {
      // Redis handles key expiration automatically.
    },
    async shutdown() {
      if (!isConnected || !client.isOpen) {
        return;
      }

      try {
        await client.quit();
      } catch (error) {
        logger.warn("Redis token blacklist shutdown encountered an error", {
          error,
          ...metadata,
        });
      } finally {
        isConnected = false;
      }
    },
  };
};

const createInMemoryTokenBlacklist = (): TokenBlacklist => {
  const entries = new Map<string, Date>();

  const cleanupExpired = () => {
    const now = Date.now();
    entries.forEach((expiresAt, key) => {
      if (expiresAt.getTime() <= now) {
        entries.delete(key);
      }
    });
  };

  return {
    async add(jti: string, expiresAt: Date) {
      entries.set(jti, expiresAt);
    },
    async has(jti: string) {
      cleanupExpired();
      const expiresAt = entries.get(jti);
      if (!expiresAt) {
        return false;
      }

      if (expiresAt.getTime() <= Date.now()) {
        entries.delete(jti);
        return false;
      }

      return true;
    },
    async remove(jti: string) {
      entries.delete(jti);
    },
    async cleanup() {
      cleanupExpired();
    },
    async shutdown() {
      entries.clear();
    },
  };
};

export interface TokenBlacklistFactoryOptions {
  url?: string;
  metadata?: LogMetadata;
}

export const createTokenBlacklist = (
  options: TokenBlacklistFactoryOptions = {},
): TokenBlacklist => {
  const logger = createChildLogger("auth:token:blacklist");
  const url = options.url ?? getConfig().cache.redisUrl;

  if (!url) {
    logger.warn("Redis URL not provided, falling back to in-memory token blacklist", {
      ...options.metadata,
    });
    return createInMemoryTokenBlacklist();
  }

  try {
    const client = createClient({ url });
    client.on("error", (error) => {
      logger.error("Redis token blacklist client emitted an error", {
        error,
        ...options.metadata,
      });
    });

    return createRedisTokenBlacklist(client, options.metadata);
  } catch (error) {
    logger.error("Failed to create Redis token blacklist client", {
      error,
      ...options.metadata,
    });
    return createInMemoryTokenBlacklist();
  }
};
