import { AsyncLocalStorage } from "node:async_hooks";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";

import { createLogger as createWinstonLogger, format, transports } from "winston";
import type { Logform, Logger as WinstonLogger } from "winston";
import DailyRotateFile from "winston-daily-rotate-file";
import type TransportStream from "winston-transport";

import type { ApplicationConfig, LogLevel } from "@lumi/types";

import { getConfig, onConfigChange } from "../config/index.js";

export interface LoggerContext {
  requestId?: string;
  spanId?: string;
  userId?: string;
  [key: string]: unknown;
}

export type LogMetadata = Record<string, unknown>;

const LOG_LEVEL_PRIORITIES: Record<LogLevel, number> = {
  fatal: 0,
  error: 1,
  warn: 2,
  info: 3,
  debug: 4,
  trace: 5,
};

const messageSymbol = Symbol.for("message");

const contextStorage = new AsyncLocalStorage<LoggerContext>();
const externalTransports = new Map<string, TransportStream>();

let consoleTransport: transports.ConsoleTransportInstance | undefined;
let rotationTransports: Partial<Record<"combined" | "error", DailyRotateFile>> = {};

const ensureDirectoryExists = (directory: string) => {
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  if (!existsSync(directory)) {
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    mkdirSync(directory, { recursive: true });
  }
};

const closeRotationTransports = () => {
  Object.values(rotationTransports).forEach((transport) => {
    transport?.close?.();
  });
  rotationTransports = {};
};

const appendContextFormat = format((info) => {
  const context = contextStorage.getStore();
  if (!context) {
    return info;
  }

  const merged = { ...(info.context as Record<string, unknown> | undefined), ...context };
  if (Object.keys(merged).length > 0) {
    // eslint-disable-next-line no-param-reassign
    info.context = merged;
  }

  if (context.requestId && !info.requestId) {
    // eslint-disable-next-line no-param-reassign
    info.requestId = context.requestId;
  }

  return info;
});

const normaliseError = (input: unknown): Record<string, unknown> => {
  if (input instanceof Error) {
    return {
      name: input.name,
      message: input.message,
      stack: input.stack,
      cause:
        input.cause instanceof Error ? normaliseError(input.cause) : (input.cause ?? undefined),
    };
  }

  if (input && typeof input === "object") {
    try {
      return JSON.parse(JSON.stringify(input)) as Record<string, unknown>;
    } catch {
      return { message: "[unserializable-error-object]" };
    }
  }

  return { message: String(input) };
};

const METADATA_EXCLUDE_FIELDS = ["timestamp", "level", "message", "context", "requestId"] as const;

const buildBaseFormat = (): Logform.Format =>
  format.combine(
    appendContextFormat(),
    format.timestamp(),
    format.errors({ stack: true }),
    format.metadata({ fillExcept: [...METADATA_EXCLUDE_FIELDS] }),
  );

const buildConsoleFormat = (config: ApplicationConfig): Logform.Format => {
  const isPrettyMode = config.app.environment === "development" && !config.runtime.ci;

  if (!isPrettyMode) {
    return format.json();
  }

  return format.combine(
    format.colorize({ all: true }),
    format.printf(({ timestamp, level, message, requestId, context, metadata, ...rest }) => {
      const parts = [`${timestamp as string} ${level as string}`, message as string];
      if (requestId) {
        parts.push(`[request:${requestId as string}]`);
      }

      const contextPayload = { ...(context as Record<string, unknown> | undefined) };

      const additional = {
        ...contextPayload,
        ...(metadata as Record<string, unknown> | undefined),
        ...rest,
      };

      const serialisable =
        Object.keys(additional).length > 0 ? ` ${JSON.stringify(additional)}` : "";

      return parts.join(" ") + serialisable;
    }),
  );
};

const buildTransports = (config: ApplicationConfig): TransportStream[] => {
  const transportList: TransportStream[] = [];
  const { logs } = config.observability;
  const activeLevel = config.app.logLevel;

  if (logs.consoleEnabled) {
    if (consoleTransport) {
      consoleTransport.level = activeLevel;
      consoleTransport.format = buildConsoleFormat(config);
    } else {
      consoleTransport = new transports.Console({
        level: activeLevel,
        format: buildConsoleFormat(config),
      });
    }
    transportList.push(consoleTransport);
  } else if (consoleTransport) {
    consoleTransport.close?.();
    consoleTransport = undefined;
  }

  const shouldWriteToDisk = config.app.environment !== "test" && !config.runtime.ci;

  if (shouldWriteToDisk) {
    const directory = path.resolve(process.cwd(), logs.directory);
    ensureDirectoryExists(directory);

    const baseName = config.app.name.toLowerCase().replaceAll(/\s+/g, "-");

    closeRotationTransports();

    const rotationOptions = {
      dirname: directory,
      datePattern: "YYYY-MM-DD",
      maxSize: logs.rotation.maxSize,
      maxFiles: logs.rotation.maxFiles,
      zippedArchive: logs.rotation.zippedArchive,
    } as const;

    const combined = new DailyRotateFile({
      ...rotationOptions,
      filename: `${baseName}-combined-%DATE%.log`,
      level: activeLevel,
      format: format.json(),
    });

    const errorOnly = new DailyRotateFile({
      ...rotationOptions,
      filename: `${baseName}-error-%DATE%.log`,
      level: "error",
      format: format.json(),
    });

    rotationTransports = { combined, error: errorOnly };
    transportList.push(combined, errorOnly);
  } else {
    closeRotationTransports();
  }

  externalTransports.forEach((transport) => {
    // eslint-disable-next-line no-param-reassign
    transport.level = activeLevel;
    transportList.push(transport);
  });

  return transportList;
};

const createLoggerDescriptor = (config: ApplicationConfig) => ({
  level: config.app.logLevel,
  levels: LOG_LEVEL_PRIORITIES,
  format: buildBaseFormat(),
  defaultMeta: {
    service: config.app.name,
    environment: config.app.environment,
  },
  transports: buildTransports(config),
  exitOnError: false,
});

const activeLogger: WinstonLogger = createWinstonLogger(createLoggerDescriptor(getConfig()));

const refreshLogger = (config: ApplicationConfig) => {
  activeLogger.configure(createLoggerDescriptor(config));
};

onConfigChange((change) => {
  refreshLogger(change.snapshot);
});

export const logger = activeLogger;

export const withRequestContext = <T>(context: LoggerContext, callback: () => T): T =>
  contextStorage.run({ ...context }, callback);

export const mergeRequestContext = (context: Partial<LoggerContext>): void => {
  const current = contextStorage.getStore() ?? {};
  contextStorage.enterWith({ ...current, ...context });
};

export const getRequestContext = (): LoggerContext => contextStorage.getStore() ?? {};

export const createChildLogger = (component: string): WinstonLogger => logger.child({ component });

export const logError = (
  error: unknown,
  message = "Unhandled error",
  metadata: LogMetadata = {},
): void => {
  const normalised = normaliseError(error);
  logger.error(message, { ...metadata, error: normalised });
};

export const registerLogTransport = (name: string, transport: TransportStream): void => {
  if (externalTransports.has(name)) {
    externalTransports.get(name)?.close?.();
  }

  externalTransports.set(name, transport);
  refreshLogger(getConfig());
};

export const unregisterLogTransport = (name: string): void => {
  const transport = externalTransports.get(name);
  if (!transport) {
    return;
  }

  transport.close?.();
  externalTransports.delete(name);
  refreshLogger(getConfig());
};

export const listRegisteredTransports = (): string[] => [...externalTransports.keys()];

export const extractStructuredLog = (
  payload: Record<string, unknown>,
): Record<string, unknown> | undefined => {
  const serialised = Reflect.get(payload, messageSymbol);
  if (typeof serialised !== "string") {
    if (!payload || Object.keys(payload).length === 0) {
      return undefined;
    }
    try {
      return JSON.parse(JSON.stringify(payload)) as Record<string, unknown>;
    } catch {
      return undefined;
    }
  }

  try {
    return JSON.parse(serialised) as Record<string, unknown>;
  } catch {
    return undefined;
  }
};
