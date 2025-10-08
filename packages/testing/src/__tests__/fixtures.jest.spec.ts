import { describe, expect, it, jest } from "@jest/globals";

import type {} from "../assertions/jest.js";
import { FixtureManager, withFixtures } from "../fixtures/fixture-manager.js";

describe("FixtureManager", () => {
  it("runs registered cleanups in reverse order", async () => {
    const calls: number[] = [];
    const manager = new FixtureManager();
    manager.register(() => {
      calls.push(1);
    });
    manager.register(async () => {
      await Promise.resolve();
      calls.push(2);
    });

    await manager.flush();

    expect(calls).toEqual([2, 1]);
  });

  it("provides convenience wrapper", async () => {
    type CleanupFn = Parameters<FixtureManager["register"]>[0];
    const cleanup = jest.fn(async () => {});
    await withFixtures(async (fixtures) => {
      fixtures.register(cleanup as CleanupFn);
    });

    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it("ignores empty cleanup slots during flush", async () => {
    const manager = new FixtureManager();
    // @ts-expect-error intentionally pushing an undefined slot to exercise branch coverage
    // eslint-disable-next-line unicorn/no-useless-undefined
    manager.register(undefined);
    await expect(manager.flush()).resolves.toBeUndefined();
  });
});
