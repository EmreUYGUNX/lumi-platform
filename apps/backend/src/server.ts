import { type Server, createServer } from "node:http";
import type { Socket } from "node:net";
import process from "node:process";

import type { Express } from "express";

import type { ApplicationConfig } from "@lumi/types";

import { type CreateAppOptions, createApp } from "./app.js";
import { getConfig } from "./config/index.js";
import { logger } from "./lib/logger.js";
import { disconnectPrismaClient } from "./lib/prisma.js";

export interface StartServerOptions extends CreateAppOptions {
  port?: number;
  shutdownTimeoutMs?: number;
  enableSignalHandlers?: boolean;
}

export interface ShutdownOptions {
  reason?: string;
  error?: unknown;
  exitAfterShutdown?: boolean;
  exitCode?: number;
}

export interface ServerController {
  app: Express;
  server: Server;
  port: number;
  isShuttingDown: () => boolean;
  shutdown: (options?: Omit<ShutdownOptions, "exitAfterShutdown" | "exitCode">) => Promise<void>;
}

const DEFAULT_SHUTDOWN_TIMEOUT_MS = 30_000;
const LISTENING_MESSAGE = "HTTP server listening";
const SHUTDOWN_COMPLETE_MESSAGE = "Shutdown complete";

interface ProcessListener {
  event: NodeJS.Signals | "uncaughtException" | "unhandledRejection" | "exit";
  handler: (...args: unknown[]) => void;
}

const destroySocketSafely = (socket: Socket) => {
  if (!socket.destroyed) {
    socket.destroy();
  }
};

const prepareSocketForDrain = (socket: Socket, timeoutMs: number, onClose: () => void) => {
  if (typeof socket.setKeepAlive === "function") {
    socket.setKeepAlive(false);
  }

  if (typeof socket.setTimeout === "function") {
    socket.setTimeout(timeoutMs);
  }

  socket.once("close", onClose);

  try {
    socket.end();
  } catch {
    destroySocketSafely(socket);
  }
};

const drainConnections = (connections: Set<Socket>, timeoutMs: number): Promise<void> =>
  new Promise((resolve) => {
    if (connections.size === 0) {
      resolve();
      return;
    }

    let hasResolved = false;

    const finish = () => {
      if (hasResolved) {
        return;
      }

      hasResolved = true;
      resolve();
    };

    const timeout = setTimeout(() => {
      connections.forEach((socket) => {
        destroySocketSafely(socket);
      });
      finish();
    }, timeoutMs);

    if (typeof timeout.unref === "function") {
      timeout.unref();
    }

    const onSocketClose = () => {
      if (connections.size === 0) {
        clearTimeout(timeout);
        finish();
      }
    };

    connections.forEach((socket) => {
      prepareSocketForDrain(socket, timeoutMs, onSocketClose);
    });
  });

const createConnectionTracker = () => {
  const connections = new Set<Socket>();

  const track = (socket: Socket) => {
    connections.add(socket);
    socket.on("close", () => {
      connections.delete(socket);
    });
  };

  return {
    track,
    drain: (timeoutMs: number) => drainConnections(connections, timeoutMs),
    count: () => connections.size,
  };
};

const createServerClosePromise = (server: Server) =>
  new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });

const logServerAddress = (address: ReturnType<Server["address"]>, fallbackPort: number) => {
  if (address && typeof address === "object") {
    logger.info(LISTENING_MESSAGE, {
      address: address.address,
      port: address.port,
      family: address.family,
    });
    return address.port;
  }

  if (typeof address === "string") {
    logger.info(LISTENING_MESSAGE, { path: address });
    return fallbackPort;
  }

  logger.info(LISTENING_MESSAGE, { port: fallbackPort });
  return fallbackPort;
};

const listenOnPort = (server: Server, port: number): Promise<number> =>
  new Promise((resolve, reject) => {
    function onListening() {
      server.off("error", onError);
      const resolvedPort = logServerAddress(server.address(), port);
      resolve(resolvedPort);
    }

    function onError(error: Error) {
      server.off("listening", onListening);
      reject(error);
    }

    server.once("error", onError);
    server.once("listening", onListening);
    server.listen(port);
  });

const setExitCodeIfNeeded = (exitAfterShutdown: boolean, exitCode?: number, error?: unknown) => {
  if (exitAfterShutdown) {
    if (typeof exitCode === "number") {
      process.exitCode = exitCode;
      return;
    }

    process.exitCode = error ? 1 : 0;
  }
};

const logShutdownStart = (reason: string, error?: unknown) => {
  if (error !== undefined) {
    logger.error("Shutdown triggered due to error", { reason, error });
    return;
  }

  logger.info("Shutdown initiated", { reason });
};

type ConnectionTracker = ReturnType<typeof createConnectionTracker>;

interface ShutdownSequenceOptions {
  reason: string;
  error?: unknown;
  exitAfterShutdown: boolean;
  exitCode?: number;
}

const drainConnectionsSafely = async (tracker: ConnectionTracker, timeoutMs: number) => {
  const activeConnections = tracker.count();
  if (activeConnections > 0) {
    logger.info("Draining active connections", {
      timeoutMs,
      activeConnections,
    });
  }

  try {
    await tracker.drain(timeoutMs);
  } catch (error) {
    logger.error("Failed to drain connections cleanly", { error });
  }
};

const waitForServerClose = async (closePromise: Promise<void>) => {
  try {
    await closePromise;
  } catch (error) {
    logger.error("HTTP server close failed", { error });
  }
};

const finaliseShutdown = (
  reason: string,
  exitAfterShutdown: boolean,
  exitCode: number | undefined,
  error?: unknown,
) => {
  logger.info(SHUTDOWN_COMPLETE_MESSAGE, { reason });
  setExitCodeIfNeeded(exitAfterShutdown, exitCode, error);
};

const createProcessListenerRegistry = () => {
  const listeners: ProcessListener[] = [];

  return {
    register(event: ProcessListener["event"], handler: (...args: unknown[]) => void) {
      process.on(event as never, handler as never);
      listeners.push({ event, handler });
    },
    cleanup() {
      listeners.forEach(({ event, handler }) => {
        process.off(event as never, handler as never);
      });
      listeners.length = 0;
    },
  };
};

const registerSignalHandlers = (
  enableSignalHandlers: boolean,
  register: (event: ProcessListener["event"], handler: (...args: unknown[]) => void) => void,
  executeShutdown: (options?: ShutdownOptions) => Promise<void>,
  cleanup: () => void,
) => {
  if (!enableSignalHandlers) {
    return;
  }

  register("SIGTERM", async () => {
    try {
      await executeShutdown({ reason: "signal:SIGTERM", exitAfterShutdown: true, exitCode: 0 });
    } catch (error) {
      logger.error("Failed to shut down after SIGTERM", { error });
    }
  });

  register("SIGINT", async () => {
    try {
      await executeShutdown({ reason: "signal:SIGINT", exitAfterShutdown: true, exitCode: 0 });
    } catch (error) {
      logger.error("Failed to shut down after SIGINT", { error });
    }
  });

  register("uncaughtException", async (err: unknown) => {
    const error = err instanceof Error ? err : new Error(String(err));
    logger.error("Uncaught exception encountered", { error });

    try {
      await executeShutdown({
        reason: "uncaughtException",
        error,
        exitAfterShutdown: true,
        exitCode: 1,
      });
    } catch (shutdownError) {
      logger.error("Failed to shut down after uncaught exception", { error: shutdownError });
    }
  });

  register("unhandledRejection", async (reason: unknown) => {
    logger.error("Unhandled promise rejection encountered", { reason });

    try {
      await executeShutdown({
        reason: "unhandledRejection",
        error: reason,
        exitAfterShutdown: true,
        exitCode: 1,
      });
    } catch (shutdownError) {
      logger.error("Failed to shut down after unhandled rejection", { error: shutdownError });
    }
  });

  register("exit", (...args: unknown[]) => {
    const code = typeof args[0] === "number" ? args[0] : undefined;
    logger.info("Process exiting", { code });
    cleanup();
  });
};

export const startServer = async (options: StartServerOptions = {}): Promise<ServerController> => {
  const config: ApplicationConfig = options.config ?? getConfig();
  const app: Express = createApp({ config });
  const requestedPort = options.port ?? config.app.port ?? 4000;
  const shutdownTimeoutMs = options.shutdownTimeoutMs ?? DEFAULT_SHUTDOWN_TIMEOUT_MS;
  const enableSignalHandlers = options.enableSignalHandlers ?? true;

  const server = createServer(app);
  const connectionTracker = createConnectionTracker();

  server.on("connection", (socket) => {
    connectionTracker.track(socket);
  });

  const resolvedPort = await listenOnPort(server, requestedPort);

  let isShuttingDown = false;
  let shutdownPromise: Promise<void> | undefined;
  const listenerRegistry = createProcessListenerRegistry();

  const runShutdownSequence = async ({
    reason,
    error,
    exitAfterShutdown,
    exitCode,
  }: ShutdownSequenceOptions) => {
    logShutdownStart(reason, error);

    const closePromise = createServerClosePromise(server);

    await drainConnectionsSafely(connectionTracker, shutdownTimeoutMs);
    const rateLimiterCleanup = app.get("rateLimiterCleanup") as (() => Promise<void>) | undefined;
    if (typeof rateLimiterCleanup === "function") {
      try {
        await rateLimiterCleanup();
      } catch (cleanupError) {
        logger.warn("Rate limiter cleanup failed during shutdown", { error: cleanupError });
      }
    }
    const mediaQueueCleanup = app.get("mediaQueueCleanup") as (() => Promise<void>) | undefined;
    if (typeof mediaQueueCleanup === "function") {
      try {
        await mediaQueueCleanup();
      } catch (cleanupError) {
        logger.warn("Media queue cleanup failed during shutdown", { error: cleanupError });
      }
    }
    await waitForServerClose(closePromise);
    await disconnectPrismaClient();

    listenerRegistry.cleanup();
    finaliseShutdown(reason, exitAfterShutdown, exitCode, error);
  };

  const executeShutdown = async ({
    reason = "manual",
    error,
    exitAfterShutdown = false,
    exitCode,
  }: ShutdownOptions = {}) => {
    if (shutdownPromise) {
      return shutdownPromise;
    }

    isShuttingDown = true;

    shutdownPromise = runShutdownSequence({
      reason,
      error,
      exitAfterShutdown,
      exitCode,
    }).finally(() => {
      isShuttingDown = false;
    });

    return shutdownPromise;
  };

  registerSignalHandlers(
    enableSignalHandlers,
    listenerRegistry.register,
    executeShutdown,
    listenerRegistry.cleanup,
  );

  return {
    app,
    server,
    port: resolvedPort,
    isShuttingDown: () => isShuttingDown,
    shutdown: (shutdownOptions) => executeShutdown({ ...shutdownOptions }),
  };
};

/**
 * @internal Exposes selected helpers strictly for unit testing.
 */
export const serverInternals = {
  createServerClosePromise,
  logServerAddress,
  drainConnectionsSafely,
  setExitCodeIfNeeded,
  registerSignalHandlers,
};
