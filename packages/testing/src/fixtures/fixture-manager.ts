type AsyncCleanup = () => Promise<void> | void;

/**
 * Manages fixture lifecycles within tests. Register cleanup callbacks that are automatically executed in reverse order.
 */
export class FixtureManager {
  private readonly cleanups: AsyncCleanup[] = [];

  register(cleanup: AsyncCleanup): void {
    this.cleanups.push(cleanup);
  }

  async flush(): Promise<void> {
    while (this.cleanups.length > 0) {
      const cleanup = this.cleanups.pop();
      if (cleanup) {
        // eslint-disable-next-line no-await-in-loop
        await cleanup();
      }
    }
  }
}

export async function withFixtures<T>(work: (fixtures: FixtureManager) => Promise<T>): Promise<T> {
  const manager = new FixtureManager();
  try {
    return await work(manager);
  } finally {
    await manager.flush();
  }
}
