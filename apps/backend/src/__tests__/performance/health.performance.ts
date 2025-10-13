import { once } from "node:events";
import { mkdirSync, writeFileSync } from "node:fs";
import type { AddressInfo } from "node:net";
import path from "node:path";

// @ts-expect-error -- 'autocannon' does not provide TypeScript declarations.
import autocannonImport from "autocannon";

import type { ApplicationConfig } from "@lumi/types";

import { createTestConfig } from "../../testing/config.js";

interface AutocannonHistogram {
  p99: number;
  [key: string]: number;
}

interface AutocannonCountStats {
  total: number;
  [key: string]: number;
}

interface AutocannonResult {
  latency: AutocannonHistogram;
  requests: AutocannonCountStats;
  throughput: Record<string, number>;
  errors: number;
  timeouts: number;
}

interface AutocannonOptions {
  url: string;
  connections: number;
  duration: number;
  method?: string;
  title?: string;
}

type AutocannonCallback = (error: Error | null, result: AutocannonResult) => void;

interface AutocannonInstance {
  on(
    event: "response",
    listener: (client: unknown, statusCode: number) => void,
  ): AutocannonInstance;
}

type Autocannon = (options: AutocannonOptions, callback?: AutocannonCallback) => AutocannonInstance;

const autocannon = autocannonImport as unknown as Autocannon;

interface BenchmarkResult {
  result: AutocannonResult;
  responses: Record<number, number>;
}

const runBenchmark = (options: AutocannonOptions): Promise<BenchmarkResult> => {
  return new Promise((resolve, reject) => {
    const responseCounters: Record<number, number> = {};
    const instance = autocannon(
      {
        ...options,
        title: options.title ?? "lumi-backend-benchmark",
      },
      (error: Error | null, result: AutocannonResult) => {
        if (error) {
          reject(error);
          return;
        }

        resolve({ result, responses: responseCounters });
      },
    );

    instance.on("response", (_client: unknown, statusCode: number) => {
      // eslint-disable-next-line security/detect-object-injection -- Autocannon emits numeric status labels that we use as keys.
      responseCounters[statusCode] = (responseCounters[statusCode] ?? 0) + 1;
    });
  });
};

const applyEnvironmentFromConfig = (config: ApplicationConfig) => {
  process.env.APP_NAME = config.app.name;
  process.env.NODE_ENV = config.app.environment;
  process.env.APP_PORT = String(config.app.port);
  process.env.PORT = String(config.app.port);
  process.env.API_BASE_URL = config.app.apiBaseUrl;
  process.env.FRONTEND_URL = config.app.frontendUrl;
  process.env.DATABASE_URL = config.database.url;
  process.env.REDIS_URL = config.cache.redisUrl;
  process.env.STORAGE_BUCKET = config.storage.bucket;
  process.env.JWT_SECRET = config.security.jwtSecret;
  process.env.LOG_LEVEL = config.app.logLevel;
};

const startServer = async (configOverrides = {}) => {
  const config = createTestConfig({
    observability: {
      logs: {
        consoleEnabled: false,
        request: {
          sampleRate: 0,
        },
      },
    },
    security: {
      rateLimit: {
        points: 1000,
        durationSeconds: 60,
        blockDurationSeconds: 30,
      },
    },
    ...configOverrides,
  });

  applyEnvironmentFromConfig(config);

  const { createApp } = await import("../../app.js");
  const app = createApp({ config });
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");

  const address = server.address() as AddressInfo;

  const stop = async () => {
    const rateLimiterCleanup = app.get("rateLimiterCleanup") as (() => Promise<void>) | undefined;
    await rateLimiterCleanup?.();
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  };

  return {
    app,
    config,
    port: address.port,
    stop,
  };
};

const verifyHealthBenchmark = (benchmark: BenchmarkResult) => {
  const { result } = benchmark;
  if (result.latency.p99 > 200) {
    throw new Error(`Health check p99 latency ${result.latency.p99}ms exceeds 200ms budget`);
  }

  if (result.requests.total < 1000) {
    throw new Error(`Health check processed only ${result.requests.total} requests (<1000 target)`);
  }

  if (result.errors > 0 || result.timeouts > 0) {
    throw new Error("Health check benchmark encountered errors or timeouts");
  }
};

const verifyConcurrencyBenchmark = (benchmark: BenchmarkResult) => {
  const { result } = benchmark;
  if (result.errors > 0 || result.timeouts > 0) {
    throw new Error("Concurrent benchmark detected errors or timeouts");
  }

  if (result.latency.p99 > 250) {
    throw new Error(`Concurrent benchmark latency exceeded threshold: ${result.latency.p99}ms`);
  }
};

const verifyRateLimitBenchmark = (benchmark: BenchmarkResult) => {
  if ((benchmark.responses[429] ?? 0) === 0) {
    throw new Error("Expected rate limiting to trigger 429 responses under load");
  }
};

const persistBaseline = (
  payload: Record<string, unknown>,
  destination = path.resolve(
    process.cwd(),
    "reports",
    "performance",
    "backend",
    "performance-baseline.json",
  ),
) => {
  const directory = path.dirname(destination);
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- Destination resolved from trusted segments.
  mkdirSync(directory, { recursive: true });
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- Destination resolved from trusted segments.
  writeFileSync(destination, `${JSON.stringify(payload, undefined, 2)}\n`, "utf8");
};

const main = async () => {
  const healthServer = await startServer();

  try {
    const healthBenchmark = await runBenchmark({
      url: `http://127.0.0.1:${healthServer.port}/api/v1/health`,
      connections: 25,
      duration: 10,
      method: "GET",
      title: "lumi-backend-health",
    });
    verifyHealthBenchmark(healthBenchmark);

    const concurrencyBenchmark = await runBenchmark({
      url: `http://127.0.0.1:${healthServer.port}/api/v1/health`,
      connections: 50,
      duration: 5,
      method: "GET",
      title: "lumi-backend-concurrency",
    });
    verifyConcurrencyBenchmark(concurrencyBenchmark);

    const rateLimitedServer = await startServer({
      security: {
        rateLimit: {
          points: 5,
          durationSeconds: 60,
          blockDurationSeconds: 120,
        },
      },
    });

    try {
      const rateLimitBenchmark = await runBenchmark({
        url: `http://127.0.0.1:${rateLimitedServer.port}/api/v1/health`,
        connections: 30,
        duration: 5,
        method: "GET",
        title: "lumi-backend-rate-limit",
      });

      verifyRateLimitBenchmark(rateLimitBenchmark);

      const baseline = {
        generatedAt: new Date().toISOString(),
        health: {
          latency: healthBenchmark.result.latency,
          requests: healthBenchmark.result.requests,
          throughput: healthBenchmark.result.throughput,
        },
        concurrency: {
          latency: concurrencyBenchmark.result.latency,
          requests: concurrencyBenchmark.result.requests,
          throughput: concurrencyBenchmark.result.throughput,
        },
        rateLimiting: {
          responses: rateLimitBenchmark.responses,
          requests: rateLimitBenchmark.result.requests,
        },
      };

      persistBaseline(baseline);
      // eslint-disable-next-line no-console -- Performance script should emit summary for operators.
      console.log("Performance baseline recorded:", baseline);
    } finally {
      await rateLimitedServer.stop();
    }
  } finally {
    await healthServer.stop();
  }
};

try {
  await main();
} catch (error) {
  // eslint-disable-next-line no-console -- Performance script must report failures explicitly.
  console.error("Performance benchmark failed:", error);
  process.exitCode = 1;
}
