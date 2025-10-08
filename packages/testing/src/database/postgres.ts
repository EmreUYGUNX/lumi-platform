import { Pool } from "pg";
import type { PoolClient } from "pg";

/**
 * Lightweight helper around pg.Pool for orchestrating database testing.
 * Consumers can opt-in by providing DATABASE_URL or an explicit connection string.
 */
export class TestDatabase {
  private readonly pool: Pool;

  constructor(connectionString = process.env.DATABASE_URL) {
    if (!connectionString) {
      throw new Error(
        "DATABASE_URL must be defined when using TestDatabase utilities. Configure a dedicated test database.",
      );
    }

    this.pool = new Pool({
      connectionString,
      max: 2,
    });
  }

  /**
   * Executes the supplied callback within a transaction that is automatically rolled back.
   * Useful for isolating state between tests.
   */
  async withTransaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const result = await callback(client);
      await client.query("ROLLBACK");
      return result;
    } finally {
      client.release();
    }
  }

  /**
   * Truncates the provided tables. When no tables are given, all user tables are truncated.
   */
  async truncateTables(...tables: string[]): Promise<void> {
    let tableNames = tables;

    if (tableNames.length === 0) {
      const result = await this.pool.query<{ tablename: string }>(
        `SELECT tablename FROM pg_tables WHERE schemaname = 'public'`,
      );
      tableNames = result.rows.map(({ tablename }) => tablename);
    }

    if (tableNames.length === 0) return;

    const joined = tableNames.map((name) => `"${name}"`).join(", ");
    await this.pool.query(`TRUNCATE ${joined} RESTART IDENTITY CASCADE`);
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

export async function createTestDatabase(connectionString?: string): Promise<TestDatabase> {
  return new TestDatabase(connectionString);
}
