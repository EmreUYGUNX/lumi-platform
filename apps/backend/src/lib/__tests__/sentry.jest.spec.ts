import { afterEach, describe, expect, it, jest } from "@jest/globals";
import type { Request, Response } from "express";

import type { ApplicationConfig } from "@lumi/types";

import { createTestConfig } from "../../testing/config.js";

const initMock = jest.fn();
const closeMock = jest.fn();
const setTagMock = jest.fn();
const addBreadcrumbMock = jest.fn();
const captureExceptionMock = jest.fn();
const setUserMock = jest.fn();
const httpIntegrationMock = jest.fn(() => ({ name: "http" }));
const linkedErrorsIntegrationMock = jest.fn(() => ({ name: "linked-errors" }));

const scopeContext = {
  user: undefined as Record<string, unknown> | undefined,
  requestContext: undefined as Record<string, unknown> | undefined,
};

const scopeMock = {
  getUser: jest.fn(() => scopeContext.user),
  setUser: jest.fn((user: Record<string, unknown> | null | undefined) => {
    scopeContext.user = user ?? undefined;
  }),
  getScopeData: jest.fn(() => ({
    contexts: {
      request: scopeContext.requestContext,
    },
  })),
  setContext: jest.fn((key: string, value: Record<string, unknown> | null) => {
    if (key === "request") {
      scopeContext.requestContext = value ?? undefined;
    }
  }),
};

const getCurrentScopeMock = jest.fn(() => scopeMock);

const importSentryModule = async () => import("../sentry.js");

type ListenerMap = Record<string, ((error?: unknown) => void)[]>;

const createMiddlewareHarness = () => {
  const listeners: ListenerMap = {};
  const response = {
    statusCode: 200,
    locals: {
      requestId: "req-123",
    },
    once: (event: string, listener: (error?: unknown) => void) => {
      // eslint-disable-next-line security/detect-object-injection -- Listener map keys are constrained to known event names for tests.
      listeners[event] = listeners[event] ?? [];
      listeners[event]?.push(listener);
      return response;
    },
  } as unknown as Response;

  const request = {
    method: "GET",
    originalUrl: "/api/v1/example",
    ip: "203.0.113.10",
    get: (header: string): string | undefined =>
      header.toLowerCase() === "user-agent" ? "integration-test-agent" : undefined,
    id: "req-123",
  } as unknown as Request;

  return { request, response, listeners };
};

jest.mock("../../config/index.js", () => {
  const changeHandlers = new Set<(change: { snapshot: ApplicationConfig }) => void>();
  let activeConfig = createTestConfig({
    observability: {
      sentryDsn: "https://ingest.sentry.test/1",
    },
  });

  return {
    getConfig: jest.fn(() => activeConfig),
    onConfigChange: jest.fn((handler: (change: { snapshot: ApplicationConfig }) => void) => {
      changeHandlers.add(handler);
      return () => changeHandlers.delete(handler);
    }),
    dispatchConfigChange: (config: ApplicationConfig) => {
      activeConfig = config;
      changeHandlers.forEach((handler) => handler({ snapshot: config }));
    },
  };
});

jest.mock("../logger.js", () => ({
  logger: {
    info: jest.fn().mockReturnThis(),
    warn: jest.fn().mockReturnThis(),
    error: jest.fn().mockReturnThis(),
  },
}));

jest.mock("@sentry/node", () => ({
  __esModule: true,
  init: initMock,
  close: closeMock,
  setTag: setTagMock,
  addBreadcrumb: addBreadcrumbMock,
  captureException: captureExceptionMock,
  setUser: setUserMock,
  getCurrentScope: getCurrentScopeMock,
  httpIntegration: httpIntegrationMock,
  linkedErrorsIntegration: linkedErrorsIntegrationMock,
}));

describe("sentry integration", () => {
  afterEach(() => {
    jest.clearAllMocks();
    scopeContext.user = undefined;
    scopeContext.requestContext = undefined;
  });

  it("initialises the Sentry client with project metadata", async () => {
    const { initializeSentry, isSentryEnabled } = await importSentryModule();
    const config = createTestConfig({
      observability: {
        sentryDsn: "https://ingest.sentry.test/project-123",
      },
      app: {
        environment: "production",
      },
    });

    await initializeSentry(config);

    expect(initMock).toHaveBeenCalledWith(
      expect.objectContaining({
        dsn: config.observability.sentryDsn,
        environment: "production",
        integrations: [expect.any(Object), expect.any(Object)],
      }),
    );
    expect(setTagMock).toHaveBeenCalledWith("service", config.app.name);
    expect(setTagMock).toHaveBeenCalledWith("environment", "production");
    expect(isSentryEnabled()).toBe(true);
  });

  it("avoids re-initialising when DSN remains unchanged", async () => {
    const { initializeSentry } = await importSentryModule();
    const config = createTestConfig({
      observability: {
        sentryDsn: "https://ingest.sentry.test/project-persist",
      },
      app: {
        environment: "staging",
      },
    });

    await initializeSentry(config);
    expect(initMock).toHaveBeenCalledTimes(1);

    await initializeSentry({ ...config, app: { ...config.app, environment: "staging" } });
    expect(initMock).toHaveBeenCalledTimes(1);
    expect(setTagMock).toHaveBeenCalledWith("environment", "staging");
  });

  it("shuts down Sentry when DSN becomes unavailable", async () => {
    const { initializeSentry, isSentryEnabled } = await importSentryModule();
    await initializeSentry(
      createTestConfig({
        observability: {
          sentryDsn: "https://ingest.sentry.test/project-deactivate",
        },
      }),
    );
    expect(isSentryEnabled()).toBe(true);

    jest.clearAllMocks();

    await initializeSentry(
      createTestConfig({
        observability: {
          sentryDsn: undefined,
        },
      }),
    );

    expect(closeMock).toHaveBeenCalled();
    expect(isSentryEnabled()).toBe(false);
  });

  it("captures request metadata and emits breadcrumbs during lifecycle events", async () => {
    const { initializeSentry, createSentryRequestMiddleware } = await importSentryModule();
    await initializeSentry(
      createTestConfig({
        observability: {
          sentryDsn: "https://ingest.sentry.test/project-lifecycle",
        },
      }),
    );

    const middleware = createSentryRequestMiddleware();

    const successHarness = createMiddlewareHarness();
    const successNext = jest.fn();
    middleware(successHarness.request, successHarness.response, successNext);

    expect(successNext).toHaveBeenCalled();
    expect(scopeMock.setContext).toHaveBeenCalledWith("request", {
      method: "GET",
      path: "/api/v1/example",
      userAgent: "integration-test-agent",
      ip: "203.0.113.10",
      requestId: "req-123",
    });

    successHarness.listeners.finish?.forEach((listener) => listener());
    expect(addBreadcrumbMock).toHaveBeenCalledWith(
      expect.objectContaining({
        category: "http",
        data: expect.objectContaining({ statusCode: 200, lifecycle: "finish" }),
      }),
    );

    addBreadcrumbMock.mockClear();

    const errorHarness = createMiddlewareHarness();
    const errorNext = jest.fn();
    middleware(errorHarness.request, errorHarness.response, errorNext);
    expect(errorNext).toHaveBeenCalled();

    const failure = new Error("middleware failure");
    errorHarness.listeners.error?.forEach((listener) => listener(failure));
    expect(captureExceptionMock).toHaveBeenCalledWith(failure);
  });

  it("restores scope context and user state after handling a request", async () => {
    const { initializeSentry, createSentryRequestMiddleware } = await importSentryModule();

    scopeContext.user = { id: "user-1" };
    scopeContext.requestContext = { method: "POST" };

    await initializeSentry(
      createTestConfig({
        observability: {
          sentryDsn: "https://ingest.sentry.test/project-cleanup",
        },
      }),
    );

    const middleware = createSentryRequestMiddleware();
    const req = {
      method: "GET",
      originalUrl: "/api/v1/cleanup",
      // eslint-disable-next-line unicorn/no-useless-undefined -- Test double intentionally returns undefined to mimic Express API.
      get: () => undefined,
    } as unknown as Request;
    const res = {
      statusCode: 200,
      locals: {},
      once: (_event: string, listener: () => void) => {
        listener();
        return res;
      },
    } as unknown as Response;

    middleware(req, res, jest.fn());

    expect(scopeMock.setUser).toHaveBeenCalledWith(scopeContext.user);
    expect(scopeMock.setContext).toHaveBeenCalledWith("request", scopeContext.requestContext);
  });

  it("manages user context tagging through helper utilities", async () => {
    const { initializeSentry, setSentryUser } = await importSentryModule();
    await initializeSentry(
      createTestConfig({
        observability: {
          sentryDsn: "https://ingest.sentry.test/project-users",
        },
      }),
    );

    setSentryUser({
      id: "user-123",
      email: "user@example.com",
      role: "admin",
    });

    expect(setUserMock).toHaveBeenCalledWith({
      id: "user-123",
      email: "user@example.com",
      username: undefined,
    });
    expect(setTagMock).toHaveBeenCalledWith("user_role", "admin");

    // eslint-disable-next-line unicorn/no-null -- Sentry API expects null to clear user context.
    setSentryUser(null);
    // eslint-disable-next-line unicorn/no-null -- Sentry API expects null to clear user context.
    expect(setUserMock).toHaveBeenCalledWith(null);
    expect(setTagMock).toHaveBeenCalledWith("user_role", "unauthenticated");
  });

  it("refreshes Sentry configuration when the config service emits changes", async () => {
    const { initializeSentry } = await importSentryModule();
    const configModule = await import("../../config/index.js");
    const updatedConfig = createTestConfig({
      observability: {
        sentryDsn: "https://ingest.sentry.test/project-update",
      },
      app: {
        environment: "staging",
      },
    });

    await initializeSentry(
      createTestConfig({
        observability: {
          sentryDsn: undefined,
        },
      }),
    );
    jest.clearAllMocks();

    // @ts-expect-error test helper exposed by module mock
    configModule.dispatchConfigChange(updatedConfig);
    await new Promise((resolve) => {
      setImmediate(resolve);
    });

    expect(initMock).toHaveBeenCalledWith(
      expect.objectContaining({
        dsn: updatedConfig.observability.sentryDsn,
      }),
    );
  });
});
