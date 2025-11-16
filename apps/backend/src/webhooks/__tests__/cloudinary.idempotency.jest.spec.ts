import { createWebhookIdempotencyStore } from "@/webhooks/cloudinary.idempotency.js";

jest.mock("@/lib/redis.js", () => {
  const mockClient = {
    connect: jest.fn(async () => {}),
    exists: jest.fn().mockResolvedValue(0),
    set: jest.fn(async () => {}),
    disconnect: jest.fn(async () => {}),
  };

  return {
    createRedisClient: jest.fn(() => mockClient),
    mockRedisClient: mockClient,
  };
});

const redisModule = jest.requireMock("@/lib/redis.js") as {
  createRedisClient: jest.Mock;
  mockRedisClient: {
    connect: jest.Mock;
    exists: jest.Mock;
    set: jest.Mock;
    disconnect: jest.Mock;
  };
};

describe("createWebhookIdempotencyStore", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("tracks duplicates in memory driver", async () => {
    const store = createWebhookIdempotencyStore({ driver: "memory" });
    const eventId = "evt-memory";

    await expect(store.isDuplicate(eventId)).resolves.toBe(false);
    await store.remember(eventId);
    await expect(store.isDuplicate(eventId)).resolves.toBe(true);
    await store.shutdown();
  });

  it("uses redis backend when available", async () => {
    redisModule.mockRedisClient.exists.mockResolvedValueOnce(1);
    const store = createWebhookIdempotencyStore();

    await expect(store.isDuplicate("evt-redis")).resolves.toBe(true);
    await store.remember("evt-redis");

    expect(redisModule.createRedisClient).toHaveBeenCalledTimes(1);
    expect(redisModule.mockRedisClient.set).toHaveBeenCalledWith(
      expect.stringContaining("evt-redis"),
      "1",
      expect.objectContaining({ EX: expect.any(Number) }),
    );

    await store.shutdown();
    expect(redisModule.mockRedisClient.disconnect).toHaveBeenCalled();
  });

  it("falls back to memory store when redis fails", async () => {
    redisModule.mockRedisClient.exists.mockRejectedValueOnce(new Error("boom"));

    const store = createWebhookIdempotencyStore();
    const eventId = "evt-fallback";

    await expect(store.isDuplicate(eventId)).resolves.toBe(false);
    await store.remember(eventId);
    await expect(store.isDuplicate(eventId)).resolves.toBe(true);

    await store.shutdown();
  });
});
