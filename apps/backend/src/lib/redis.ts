import { createClient } from "redis";

import { getConfig } from "@/config/index.js";

import { createChildLogger } from "./logger.js";

export interface RedisClientOptions {
  url?: string;
  name?: string;
}

const DEFAULT_CLIENT_NAME = "lumi-backend";
const MAX_RECONNECT_DELAY_MS = 2000;

export type RedisClientInstance = ReturnType<typeof createClient>;

export const createRedisClient = (options: RedisClientOptions = {}): RedisClientInstance => {
  const logger = createChildLogger("redis:client");
  const url = options.url ?? getConfig().cache.redisUrl;

  if (!url) {
    throw new Error("Redis URL is not configured");
  }

  const name = options.name ?? DEFAULT_CLIENT_NAME;

  const client = createClient({
    url,
    name,
    socket: {
      keepAlive: true,
      keepAliveInitialDelay: 5000,
      reconnectStrategy: (retries) => Math.min(retries * 100, MAX_RECONNECT_DELAY_MS),
    },
  });

  client.on("error", (error) => {
    logger.error("Redis client error", {
      error,
      name,
      url,
    });
  });

  client.on("reconnecting", () => {
    logger.warn("Redis client reconnecting", {
      name,
      url,
    });
  });

  client.on("ready", () => {
    logger.debug("Redis client ready", {
      name,
      url,
    });
  });

  return client;
};
