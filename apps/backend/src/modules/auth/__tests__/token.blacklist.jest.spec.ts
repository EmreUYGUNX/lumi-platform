import type { TokenBlacklist } from "../token.blacklist.js";
import { createTokenBlacklist } from "../token.blacklist.js";

jest.mock("node:timers/promises", () => ({
  __esModule: true,
  setTimeout: jest.fn(() => Promise.resolve()),
}));

const { setTimeout: setTimeoutMock } = jest.requireMock("node:timers/promises") as {
  setTimeout: jest.Mock;
};

const createClientMock = jest.fn();

jest.mock("redis", () => ({
  __esModule: true,
  createClient: (...args: unknown[]) => createClientMock(...args),
}));

interface MockLogger {
  child: jest.Mock;
  debug: jest.Mock;
  error: jest.Mock;
  info: jest.Mock;
  warn: jest.Mock;
}

const loggerInstances: { args: unknown[]; logger: MockLogger }[] = [];

const createChildLoggerMock = jest.fn((...args: unknown[]) => {
  const logger: MockLogger = {
    child: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  };
  loggerInstances.push({ args, logger });
  return logger;
});

jest.mock("@/lib/logger.js", () => ({
  __esModule: true,
  createChildLogger: (...args: unknown[]) => createChildLoggerMock(...args),
}));

interface MockRedisClient {
  isOpen: boolean;
  connect: jest.Mock<Promise<void>, []>;
  quit: jest.Mock<Promise<void>, []>;
  set: jest.Mock<Promise<unknown>, [string, string, { EX: number }]>;
  exists: jest.Mock<Promise<number>, [string]>;
  del: jest.Mock<Promise<number>, [string]>;
  on: jest.Mock;
}

const createMockRedisClient = (): MockRedisClient => {
  const client: Partial<MockRedisClient> = {
    isOpen: false,
    connect: jest.fn(async () => {
      client.isOpen = true;
    }),
    quit: jest.fn(async () => {
      client.isOpen = false;
    }),
    set: jest.fn(),
    exists: jest.fn(),
    del: jest.fn(),
    on: jest.fn(),
  };

  return client as MockRedisClient;
};

const createInMemoryBlacklist = (): TokenBlacklist => createTokenBlacklist({ url: "" });

const expectMockCall = <Args extends unknown[]>(mockFn: jest.Mock, index: number): Args => {
  const call = mockFn.mock.calls[index];
  expect(call).toBeDefined();
  return call as Args;
};

beforeEach(() => {
  jest.clearAllMocks();
  setTimeoutMock.mockImplementation(() => Promise.resolve());
  createClientMock.mockReset();
  loggerInstances.length = 0;
  createChildLoggerMock.mockImplementation((...args: unknown[]) => {
    const logger = {
      child: jest.fn(),
      debug: jest.fn(),
      error: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
    };
    loggerInstances.push({ args, logger });
    return logger;
  });
});

describe("createTokenBlacklist (redis)", () => {
  it("connects lazily and supports add, has, remove, and shutdown", async () => {
    const client = createMockRedisClient();
    client.set.mockResolvedValue("OK");
    client.exists.mockResolvedValueOnce(1).mockResolvedValueOnce(0);
    client.del.mockResolvedValue(1);
    createClientMock.mockReturnValueOnce(client);

    const blacklist = createTokenBlacklist({ url: "redis://localhost:6379" });
    const futureExpiry = new Date(Date.now() + 5000);

    await blacklist.add("token-1", futureExpiry);

    expect(client.connect).toHaveBeenCalledTimes(1);
    expect(client.set).toHaveBeenCalledWith(expect.stringContaining("token-1"), "1", {
      EX: expect.any(Number),
    });

    const futureCall = expectMockCall<[string, string, { EX: number }]>(client.set, 0);
    expect(futureCall[2].EX).toBeGreaterThanOrEqual(1);

    const invalidExpiry = new Date("invalid");
    await blacklist.add("token-invalid", invalidExpiry);

    expect(client.connect).toHaveBeenCalledTimes(1);
    const invalidCall = expectMockCall<[string, string, { EX: number }]>(client.set, 1);
    expect(invalidCall[2].EX).toBe(1);

    await blacklist.add("token-expired", new Date(Date.now() - 1));
    const expiredCall = expectMockCall<[string, string, { EX: number }]>(client.set, 2);
    expect(expiredCall[2].EX).toBe(1);

    await expect(blacklist.has("token-1")).resolves.toBe(true);
    await expect(blacklist.has("missing-token")).resolves.toBe(false);
    expect(client.exists).toHaveBeenCalledTimes(2);

    await blacklist.remove("token-1");
    expect(client.del).toHaveBeenCalledWith(expect.stringContaining("token-1"));

    await blacklist.shutdown();
    expect(client.quit).toHaveBeenCalledTimes(1);
    expect(client.isOpen).toBe(false);

    await blacklist.shutdown();
    expect(client.quit).toHaveBeenCalledTimes(1);
  });

  it("retries redis operations and eventually succeeds", async () => {
    const client = createMockRedisClient();
    client.set
      .mockRejectedValueOnce(new Error("transient 1"))
      .mockRejectedValueOnce(new Error("transient 2"))
      .mockResolvedValue("OK");
    createClientMock.mockReturnValueOnce(client);

    const blacklist = createTokenBlacklist({ url: "redis://localhost:6379" });
    const futureExpiry = new Date(Date.now() + 1000);

    await blacklist.add("retry-token", futureExpiry);

    expect(client.set).toHaveBeenCalledTimes(3);
    expect(setTimeoutMock).toHaveBeenCalledTimes(2);
  });

  it("propagates a meaningful error when retries are exhausted", async () => {
    const client = createMockRedisClient();
    client.set.mockRejectedValue("permanent failure");
    createClientMock.mockReturnValueOnce(client);

    const blacklist = createTokenBlacklist({ url: "redis://localhost:6379" });

    await expect(blacklist.add("fail-token", new Date(Date.now() + 1000))).rejects.toThrow(
      "Redis operation failed",
    );
    expect(client.set).toHaveBeenCalledTimes(3);
    expect(setTimeoutMock).toHaveBeenCalledTimes(3);
  });

  it("logs redis client errors and continues operating", async () => {
    const client = createMockRedisClient();
    const errorHandlers: ((error: unknown) => void)[] = [];
    client.on.mockImplementation((_event: string, handler: (error: unknown) => void) => {
      errorHandlers.push(handler);
      return client;
    });
    client.set.mockResolvedValue("OK");
    createClientMock.mockReturnValueOnce(client);

    const blacklist = createTokenBlacklist({
      url: "redis://localhost:6379",
      metadata: { requestId: "abc" },
    });

    expect(client.on).toHaveBeenCalledWith("error", expect.any(Function));

    await blacklist.add("token", new Date(Date.now() + 1000));

    expect(errorHandlers).toHaveLength(1);
    const { logger } = loggerInstances.find(({ args }) => args[0] === "auth:token:blacklist")!;
    const errorHandler = errorHandlers[0];
    expect(errorHandler).toBeDefined();
    errorHandler?.(new Error("boom"));
    expect(logger.error).toHaveBeenCalledWith(
      "Redis token blacklist client emitted an error",
      expect.objectContaining({ error: expect.any(Error), requestId: "abc" }),
    );
  });
});

describe("createTokenBlacklist (in-memory)", () => {
  it("falls back to in-memory when url is missing", async () => {
    const blacklist = createInMemoryBlacklist();

    await expect(blacklist.has("missing")).resolves.toBe(false);

    const futureExpiry = new Date(Date.now() + 1000);
    await blacklist.add("token", futureExpiry);
    await expect(blacklist.has("token")).resolves.toBe(true);

    const expiredDate = new Date(Date.now() - 1000);
    await blacklist.add("expired", expiredDate);
    await expect(blacklist.has("expired")).resolves.toBe(false);

    await blacklist.cleanup();
    await blacklist.shutdown();

    expect(createClientMock).not.toHaveBeenCalled();
    const { logger } = loggerInstances.find(({ args }) => args[0] === "auth:token:blacklist")!;
    expect(logger.warn).toHaveBeenCalledWith(
      "Redis URL not provided, falling back to in-memory token blacklist",
      {},
    );
  });

  it("uses in-memory fallback if redis client creation throws", async () => {
    createClientMock.mockImplementationOnce(() => {
      throw new Error("redis unavailable");
    });

    const blacklist = createTokenBlacklist({
      url: "redis://throws",
      metadata: { region: "eu-west-1" },
    });

    await blacklist.add("token", new Date(Date.now() + 1000));
    await expect(blacklist.has("token")).resolves.toBe(true);

    const { logger } = loggerInstances.find(({ args }) => args[0] === "auth:token:blacklist")!;
    expect(logger.error).toHaveBeenCalledWith(
      "Failed to create Redis token blacklist client",
      expect.objectContaining({ error: expect.any(Error), region: "eu-west-1" }),
    );
  });
});
