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
let rotationTransport: DailyRotateFile | undefined;

const ensureDirectoryExists = (directory: string) => {
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  if (!existsSync(directory)) {
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    mkdirSync(directory, { recursive: true });
  }
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

const buildLogFormat = (): Logform.Format =>
  format.combine(
    appendContextFormat(),
    format.timestamp(),
    format.errors({ stack: true }),
    format.metadata({ fillExcept: ["timestamp", "level", "message", "context", "requestId"] }),
    format.json(),
  );

const buildTransports = (config: ApplicationConfig): TransportStream[] => {
  const transportList: TransportStream[] = [];
  const { logs } = config.observability;
  const activeLevel = config.app.logLevel;

  if (logs.consoleEnabled) {
    if (consoleTransport) {
      consoleTransport.level = activeLevel;
    } else {
      consoleTransport = new transports.Console({ level: activeLevel });
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

    const filename = `${config.app.name.toLowerCase()}-%DATE%.log`;

    rotationTransport?.close?.();

    rotationTransport = new DailyRotateFile({
      dirname: directory,
      filename,
      datePattern: "YYYY-MM-DD",
      maxSize: logs.rotation.maxSize,
      maxFiles: logs.rotation.maxFiles,
      zippedArchive: logs.rotation.zippedArchive,
      level: activeLevel,
    });

    transportList.push(rotationTransport);
  } else if (rotationTransport) {
    rotationTransport.close?.();
    rotationTransport = undefined;
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
  format: buildLogFormat(),
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
    return undefined;
  }

  try {
    return JSON.parse(serialised) as Record<string, unknown>;
  } catch {
    return undefined;
  }
};
