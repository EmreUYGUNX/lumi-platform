import { afterEach, describe, expect, it, jest } from "@jest/globals";
import type { Pool, PoolClient } from "pg";

import { TestDatabase, createTestDatabase } from "../database/postgres.js";

const TEST_CONNECTION = "postgresql://tester:secret@localhost:5432/test";

function extractPool(db: TestDatabase): Pool {
  return (db as unknown as { pool: Pool }).pool;
}

describe("TestDatabase", () => {
  const originalDatabaseUrl = process.env.DATABASE_URL;

  afterEach(() => {
    process.env.DATABASE_URL = originalDatabaseUrl;
    jest.restoreAllMocks();
  });

  it("throws when a connection string is not provided", () => {
    delete process.env.DATABASE_URL;
    expect(() => new TestDatabase()).toThrow("DATABASE_URL must be defined");
  });

  it("wraps callbacks in a rollback-only transaction", async () => {
    const db = new TestDatabase(TEST_CONNECTION);
    const pool = extractPool(db);

    const rawClient = {
      query: jest.fn(async () => {}),
      release: jest.fn(),
    };

    rawClient.query
      .mockImplementationOnce(async () => {}) // BEGIN
      .mockImplementationOnce(async () => {}) // user callback
      .mockImplementationOnce(async () => {}); // ROLLBACK

    const connectSpy = jest
      .spyOn(pool, "connect")
      .mockImplementation(async () => rawClient as unknown as PoolClient);
    const endSpy = jest.spyOn(pool, "end").mockImplementation(async () => {});

    const result = await db.withTransaction(async (client) => {
      await client.query("SELECT 1");
      return "ok";
    });

    expect(result).toBe("ok");
    expect(connectSpy).toHaveBeenCalledTimes(1);
    expect(rawClient.query).toHaveBeenNthCalledWith(1, "BEGIN");
    expect(rawClient.query).toHaveBeenNthCalledWith(2, "SELECT 1");
    expect(rawClient.query).toHaveBeenLastCalledWith("ROLLBACK");
    expect(rawClient.release).toHaveBeenCalledTimes(1);

    await db.close();
    expect(endSpy).toHaveBeenCalledTimes(1);
  });

  it("truncates explicit tables", async () => {
    const db = new TestDatabase(TEST_CONNECTION);
    const pool = extractPool(db);

    const querySpy = jest.spyOn(pool, "query").mockImplementation(async () => {});
    const endSpy = jest.spyOn(pool, "end").mockImplementation(async () => {});

    await db.truncateTables("users", "orders");

    expect(querySpy).toHaveBeenCalledWith('TRUNCATE "users", "orders" RESTART IDENTITY CASCADE');
    await db.close();
    expect(endSpy).toHaveBeenCalledTimes(1);
  });

  it("discovers tables when none are provided", async () => {
    const db = new TestDatabase(TEST_CONNECTION);
    const pool = extractPool(db);

    const querySpy = jest.spyOn(pool, "query");
    querySpy
      .mockImplementationOnce(async () => ({
        rows: [{ tablename: "products" }, { tablename: "categories" }],
      }))
      .mockImplementationOnce(async () => {});
    const endSpy = jest.spyOn(pool, "end").mockImplementation(async () => {});

    await db.truncateTables();

    expect(querySpy).toHaveBeenNthCalledWith(1, expect.stringContaining("SELECT tablename"));
    expect(querySpy).toHaveBeenNthCalledWith(
      2,
      'TRUNCATE "products", "categories" RESTART IDENTITY CASCADE',
    );

    await db.close();
    expect(endSpy).toHaveBeenCalledTimes(1);
  });

  it("skips truncation when there are no user tables", async () => {
    const db = new TestDatabase(TEST_CONNECTION);
    const pool = extractPool(db);

    const querySpy = jest.spyOn(pool, "query").mockImplementationOnce(async () => ({ rows: [] }));

    await db.truncateTables();

    expect(querySpy).toHaveBeenCalledTimes(1);
    await db.close();
  });

  it("creates a database instance via the factory helper", async () => {
    const db = await createTestDatabase(TEST_CONNECTION);
    const pool = extractPool(db);

    const endSpy = jest.spyOn(pool, "end").mockImplementation(async () => {});

    await db.close();
    expect(endSpy).toHaveBeenCalledTimes(1);
  });
});
