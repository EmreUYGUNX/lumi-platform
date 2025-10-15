import { execFile, spawn } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import type { PrismaClient } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { Pool } from "pg";

const execFileAsync = promisify(execFile);

const PROJECT_ROOT = path.resolve(__dirname, "../../../../..");
const BACKEND_DIR = path.join(PROJECT_ROOT, "apps", "backend");
const DEFAULT_POSTGRES_IMAGE = process.env.LUMI_TEST_POSTGRES_IMAGE ?? "postgres:16.4-alpine";
const DEFAULT_DATABASE = process.env.LUMI_TEST_DATABASE ?? "lumi_test";
const DEFAULT_USERNAME = process.env.LUMI_TEST_DATABASE_USER ?? "lumi";
const DEFAULT_PASSWORD = process.env.LUMI_TEST_DATABASE_PASSWORD ?? "lumipass";
const SHADOW_DB_SUFFIX = "_shadow";

const createShadowDatabaseName = (base: string) => `${base}${SHADOW_DB_SUFFIX}`;

const normaliseDatabaseUrl = (baseUrl: string, databaseName: string): string => {
  const url = new URL(baseUrl);
  url.pathname = `/${databaseName}`;
  return url.toString();
};

const getAvailablePort = async (): Promise<number> =>
  new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", (error) => {
      server.close();
      reject(error);
    });
    server.listen(0, () => {
      const address = server.address();
      if (typeof address === "object" && address) {
        const { port } = address;
        server.close(() => resolve(port));
      } else {
        server.close(() => reject(new Error("Failed to acquire ephemeral port.")));
      }
    });
  });

const ensureShadowDatabaseExists = async (
  adminConnectionUrl: string,
  shadowDatabaseName: string,
  owner: string,
): Promise<void> => {
  const pool = new Pool({ connectionString: adminConnectionUrl });
  try {
    const existing = await pool.query<{ exists: boolean }>(
      `SELECT EXISTS(SELECT 1 FROM pg_database WHERE datname = $1) AS exists`,
      [shadowDatabaseName],
    );

    if (existing.rows[0]?.exists) {
      return;
    }

    await pool.query(`CREATE DATABASE "${shadowDatabaseName}" OWNER "${owner}"`);
  } finally {
    await pool.end();
  }
};

const buildPrismaEnv = (
  databaseUrl: string,
  shadowDatabaseUrl: string,
): Record<string, string | undefined> => ({
  ...process.env,
  DATABASE_URL: databaseUrl,
  SHADOW_DATABASE_URL: shadowDatabaseUrl,
  NODE_ENV: "test",
  PRISMA_HIDE_UPDATE_MESSAGE: "1",
});

interface EmbeddedBinaryPaths {
  initdb: string;
  postgres: string;
  libDir: string;
}

const resolveEmbeddedBinaries = (): EmbeddedBinaryPaths => {
  if (process.platform === "linux" && process.arch === "x64") {
    const baseDir = path.join(
      PROJECT_ROOT,
      "node_modules",
      "@embedded-postgres",
      "linux-x64",
      "native",
    );
    return {
      initdb: path.join(baseDir, "bin", "initdb"),
      postgres: path.join(baseDir, "bin", "postgres"),
      libDir: path.join(baseDir, "lib"),
    };
  }

  throw new Error(
    `Embedded Postgres fallback is not supported on platform ${process.platform} (${process.arch}).`,
  );
};

const createEmbeddedEnvironment = (binaries: EmbeddedBinaryPaths): NodeJS.ProcessEnv => ({
  ...process.env,
  LD_LIBRARY_PATH: `${binaries.libDir}${path.delimiter}${process.env.LD_LIBRARY_PATH ?? ""}`,
});

const markExecutable = async (target: string): Promise<void> => {
  try {
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- Binary path resolved from trusted embedded-postgres metadata.
    await fs.chmod(target, 0o755);
  } catch (error) {
    if (process.env.LUMI_TEST_DATABASE_VERBOSE === "true") {
      // eslint-disable-next-line no-console
      console.warn("[embedded-postgres] unable to adjust permissions", { target, error });
    }
  }
};

const markEmbeddedBinariesExecutable = async (binaries: EmbeddedBinaryPaths): Promise<void> => {
  await Promise.all([markExecutable(binaries.initdb), markExecutable(binaries.postgres)]);
};

const runEmbeddedInitDb = async (
  initDbBinary: string,
  dataDir: string,
  environment: NodeJS.ProcessEnv,
  passwordFile: string,
  username: string,
): Promise<void> => {
  await execFileAsync(
    initDbBinary,
    [
      `--pgdata=${dataDir}`,
      "--auth=scram-sha-256",
      `--username=${username}`,
      `--pwfile=${passwordFile}`,
      "--nosync",
    ],
    { env: environment },
  );
};

const spawnEmbeddedServer = (
  postgresBinary: string,
  dataDir: string,
  port: number,
  environment: NodeJS.ProcessEnv,
): ChildProcess =>
  spawn(postgresBinary, ["-D", dataDir, "-p", port.toString()], {
    env: environment,
    stdio: ["ignore", "pipe", "pipe"],
  });

const waitForEmbeddedServer = async (server: ChildProcess): Promise<void> => {
  const timeoutMs = 15e3;
  let timer: NodeJS.Timeout | undefined;

  await new Promise<void>((resolve, reject) => {
    function handleMessage(chunk: unknown): void {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk ?? ""));
      const message = buffer.toString("utf8");

      if (process.env.LUMI_TEST_DATABASE_VERBOSE === "true") {
        // eslint-disable-next-line no-console
        console.info("[embedded-postgres]", message);
      }

      if (message.toLowerCase().includes("database system is ready to accept connections")) {
        finish(resolve);
      }
    }

    function handleError(error: Error): void {
      finish(() => reject(error));
    }

    function handleExit(code: number | null): void {
      finish(() => {
        reject(new Error(`Embedded postgres exited prematurely with code ${code ?? "null"}`));
      });
    }

    function cleanup(): void {
      if (timer) {
        clearTimeout(timer);
      }
      server.stderr?.off("data", handleMessage);
      server.stdout?.off("data", handleMessage);
      server.off("error", handleError);
      server.off("exit", handleExit);
    }

    function finish(callback: () => void): void {
      cleanup();
      callback();
    }

    timer = setTimeout(() => {
      finish(() => reject(new Error("Embedded postgres failed to start within 15 seconds.")));
    }, timeoutMs);

    server.stderr?.on("data", handleMessage);
    server.stdout?.on("data", handleMessage);
    server.once("error", handleError);
    server.once("exit", handleExit);
  }).catch((error) => {
    server.kill("SIGKILL");
    throw error;
  });
};

export interface PrismaCommandResult {
  stdout: string;
  stderr: string;
}

export class TestDatabaseManager {
  private container?: StartedPostgreSqlContainer;

  private connectionString?: string;

  private shadowConnectionString?: string;

  private prismaClient?: PrismaClient;

  private migrationsApplied = false;

  private readonly image: string;

  private readonly databaseName: string;

  private readonly username: string;

  private readonly password: string;

  private embeddedDataDir?: string;

  private embeddedPort?: number;

  private embeddedProcess?: ReturnType<typeof spawn>;

  private usingEmbedded = false;

  constructor({
    image = DEFAULT_POSTGRES_IMAGE,
    databaseName = `${DEFAULT_DATABASE}_${randomUUID().replaceAll("-", "").slice(0, 12)}`,
    username = DEFAULT_USERNAME,
    password = DEFAULT_PASSWORD,
  }: Partial<{
    image: string;
    databaseName: string;
    username: string;
    password: string;
  }> = {}) {
    this.image = image;
    this.databaseName = databaseName;
    this.username = username;
    this.password = password;
  }

  private async startContainer(): Promise<void> {
    if (this.container || this.usingEmbedded) {
      return;
    }

    try {
      const container = await new PostgreSqlContainer(this.image)
        .withDatabase(this.databaseName)
        .withUsername(this.username)
        .withPassword(this.password)
        .withStartupTimeout(120_000)
        .start();

      this.container = container;
      this.connectionString = container.getConnectionUri();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.toLowerCase().includes("could not find a working container runtime strategy")) {
        await this.startEmbeddedInstance();
      } else {
        throw error;
      }
    }

    if (!this.connectionString) {
      throw new Error("Failed to initialise test database connection.");
    }

    const adminUrl = new URL(this.connectionString);
    adminUrl.pathname = "/postgres";

    const shadowName = createShadowDatabaseName(this.databaseName);
    await ensureShadowDatabaseExists(adminUrl.toString(), shadowName, this.username);
    this.shadowConnectionString = normaliseDatabaseUrl(this.connectionString, shadowName);

    process.env.DATABASE_URL = this.connectionString;
    process.env.SHADOW_DATABASE_URL = this.shadowConnectionString;
    process.env.DATABASE_POOL_MIN = "5";
    process.env.DATABASE_POOL_MAX = "20";
    process.env.DATABASE_SLOW_QUERY_THRESHOLD_MS = "200";
  }

  private async startEmbeddedInstance(): Promise<void> {
    if (this.usingEmbedded) {
      return;
    }

    const binaries = resolveEmbeddedBinaries();
    await markEmbeddedBinariesExecutable(binaries);

    const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), "lumi-embedded-pg-"));
    const passwordFile = path.join(os.tmpdir(), `lumi-pg-password-${randomUUID()}`);
    const embeddedEnv = createEmbeddedEnvironment(binaries);

    try {
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- Password file is generated within a controlled temporary directory.
      await fs.writeFile(passwordFile, `${this.password}\n`, { mode: 0o600 });
      await runEmbeddedInitDb(binaries.initdb, dataDir, embeddedEnv, passwordFile, this.username);
    } finally {
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- Password file resides in controlled temporary directory.
      await fs.unlink(passwordFile).catch(() => {});
    }

    const port = await getAvailablePort();
    const server = spawnEmbeddedServer(binaries.postgres, dataDir, port, embeddedEnv);
    await waitForEmbeddedServer(server);
    await this.ensureEmbeddedDatabaseExists(port);

    this.embeddedProcess = server;
    this.embeddedDataDir = dataDir;
    this.embeddedPort = port;
    this.connectionString = `postgresql://${encodeURIComponent(this.username)}:${encodeURIComponent(this.password)}@127.0.0.1:${port}/${this.databaseName}`;
    this.usingEmbedded = true;
  }

  private async ensureEmbeddedDatabaseExists(port: number): Promise<void> {
    const adminConnection = `postgresql://${encodeURIComponent(this.username)}:${encodeURIComponent(this.password)}@127.0.0.1:${port}/postgres`;
    const adminPool = new Pool({ connectionString: adminConnection });

    try {
      await adminPool.query(`CREATE DATABASE "${this.databaseName}" OWNER "${this.username}"`);
    } catch (error) {
      const code =
        typeof error === "object" && error && "code" in error
          ? (error as { code?: string }).code
          : undefined;
      if (code !== "42P04") {
        throw error;
      }
    } finally {
      await adminPool.end();
    }
  }

  private async ensureMigrations(): Promise<void> {
    await this.startContainer();
    if (this.migrationsApplied) {
      return;
    }

    if (!this.connectionString || !this.shadowConnectionString) {
      throw new Error("Test database connection details missing.");
    }

    await this.runPrismaCommand(["migrate", "deploy"]);
    this.migrationsApplied = true;
  }

  private async ensureClient(): Promise<PrismaClient> {
    await this.ensureMigrations();
    if (this.prismaClient) {
      return this.prismaClient;
    }

    if (!this.connectionString) {
      throw new Error("Test database connection string not initialised.");
    }

    const { PrismaClient: PrismaClientCtor } = await import("@prisma/client");
    this.prismaClient = new PrismaClientCtor({
      datasourceUrl: this.connectionString,
      log: process.env.LUMI_TEST_DATABASE_LOG_QUERIES === "true" ? ["query", "error"] : ["error"],
    });
    await this.prismaClient.$connect();
    return this.prismaClient;
  }

  async getPrismaClient(): Promise<PrismaClient> {
    return this.ensureClient();
  }

  async resetDatabase(): Promise<void> {
    const prisma = await this.ensureClient();
    const tables = await prisma.$queryRaw<{ tablename: string }[]>`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
        AND tablename <> '_prisma_migrations'
    `;

    if (tables.length === 0) {
      return;
    }

    const tableNames = tables.map(({ tablename }) => Prisma.raw(`"${tablename}"`));
    const truncateStatement = Prisma.sql`TRUNCATE ${Prisma.join(tableNames)} RESTART IDENTITY CASCADE`;
    await prisma.$executeRaw(truncateStatement);
  }

  async runPrismaCommand(
    args: string[],
    options: { env?: Record<string, string | undefined> } = {},
  ): Promise<PrismaCommandResult> {
    await this.startContainer();
    if (!this.connectionString || !this.shadowConnectionString) {
      throw new Error("Test database environment not initialised.");
    }

    const { stdout, stderr } = await execFileAsync("pnpm", ["exec", "prisma", ...args], {
      cwd: BACKEND_DIR,
      env: {
        ...buildPrismaEnv(this.connectionString, this.shadowConnectionString),
        ...options.env,
      } as NodeJS.ProcessEnv,
    });

    return { stdout, stderr };
  }

  async seedDatabase(env: Record<string, string | undefined> = {}): Promise<void> {
    await this.runPrismaCommand(["db", "seed"], { env });
  }

  async stop(): Promise<void> {
    if (this.prismaClient) {
      await this.prismaClient.$disconnect();
      this.prismaClient = undefined;
    }

    if (this.container) {
      await this.container.stop();
      this.container = undefined;
    }

    if (this.embeddedProcess) {
      const handle = this.embeddedProcess;
      await new Promise<void>((resolve) => {
        const cleanup = () => {
          handle.removeAllListeners("exit");
          resolve();
        };

        handle.once("exit", cleanup);
        if (!handle.kill("SIGTERM")) {
          cleanup();
          return;
        }

        setTimeout(() => {
          if (!handle.killed) {
            handle.kill("SIGKILL");
          }
        }, 5e3);
      });
      this.embeddedProcess = undefined;
    }

    if (this.embeddedDataDir) {
      await fs.rm(this.embeddedDataDir, { recursive: true, force: true });
      this.embeddedDataDir = undefined;
    }

    this.embeddedPort = undefined;
    this.connectionString = undefined;
    this.shadowConnectionString = undefined;
    this.migrationsApplied = false;
    this.usingEmbedded = false;
  }

  getConnectionString(): string {
    if (!this.connectionString) {
      throw new Error("Test database is not started.");
    }
    return this.connectionString;
  }

  getShadowConnectionString(): string {
    if (!this.shadowConnectionString) {
      throw new Error("Test database shadow connection is not initialised.");
    }
    return this.shadowConnectionString;
  }
}

let sharedManager: TestDatabaseManager | undefined;

export const getTestDatabaseManager = (): TestDatabaseManager => {
  if (!sharedManager) {
    sharedManager = new TestDatabaseManager({});
  }
  return sharedManager;
};

export const disposeSharedTestDatabase = async (): Promise<void> => {
  if (!sharedManager) {
    return;
  }
  await sharedManager.stop();
  sharedManager = undefined;
};
