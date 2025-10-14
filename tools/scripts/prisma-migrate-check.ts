import { readdirSync } from "node:fs";
import path from "node:path";

import { formatDuration, heading, info, repoRoot, runCommand, success, warn } from "./utils";

const DEFAULT_DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/lumi";
const DEFAULT_SHADOW_DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/lumi_shadow";

interface CheckCommand {
  label: string;
  command: string;
  args: string[];
  optional?: boolean;
}

const databaseUrl = process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL;
const shadowDatabaseUrl = process.env.SHADOW_DATABASE_URL ?? DEFAULT_SHADOW_DATABASE_URL;

const commonEnv = {
  ...process.env,
  DATABASE_URL: databaseUrl,
  SHADOW_DATABASE_URL: shadowDatabaseUrl,
};

const BACKEND_PACKAGE = "@lumi/backend";
const PRISMA_SCHEMA_PATH = "prisma/schema.prisma";
const PRISMA_MIGRATIONS_PATH = "prisma/migrations";

const runBackendScriptArgs = (script: string): string[] => [
  "--filter",
  BACKEND_PACKAGE,
  "run",
  script,
];

const commands: CheckCommand[] = [
  {
    label: "Prisma schema validation",
    command: "pnpm",
    args: runBackendScriptArgs("prisma:validate"),
  },
  {
    label: "Apply pending migrations",
    command: "pnpm",
    args: runBackendScriptArgs("prisma:migrate:deploy"),
  },
  {
    label: "Migration status",
    command: "pnpm",
    args: runBackendScriptArgs("prisma:migrate:status"),
  },
  {
    label: "Migration drift detection",
    command: "pnpm",
    args: [
      "exec",
      "prisma",
      "migrate",
      "diff",
      "--from-migrations",
      PRISMA_MIGRATIONS_PATH,
      "--to-schema-datamodel",
      PRISMA_SCHEMA_PATH,
      "--shadow-database-url",
      shadowDatabaseUrl,
      "--exit-code",
    ],
  },
  {
    label: "Prisma client generation",
    command: "pnpm",
    args: runBackendScriptArgs("prisma:generate"),
    optional: true,
  },
];

const MIGRATION_NAME_PATTERN = /^\d{8}-\d{6}_[\d_a-z]+$/;

function ensureMigrationNaming(): void {
  const migrationsDir = path.resolve(repoRoot, PRISMA_MIGRATIONS_PATH);
  // The directory path is deterministic; lint rule disabled intentionally.
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  const entries = readdirSync(migrationsDir, { withFileTypes: true });
  const invalid = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => !MIGRATION_NAME_PATTERN.test(name));

  if (invalid.length > 0) {
    throw new Error(
      `Invalid migration folder names detected: ${invalid.join(
        ", ",
      )}. Expected pattern ${MIGRATION_NAME_PATTERN}`,
    );
  }
}

async function main(): Promise<void> {
  heading("Prisma Migration Validation");
  info(`Using DATABASE_URL=${databaseUrl}`);
  info(`Using SHADOW_DATABASE_URL=${shadowDatabaseUrl}`);

  ensureMigrationNaming();

  await runCommandsSequentially();
}

async function runCommandsSequentially(index = 0): Promise<void> {
  if (index >= commands.length) {
    return;
  }

  const commandConfig = commands.at(index);
  if (!commandConfig) {
    return;
  }

  const { label, command, args, optional } = commandConfig;
  info(`Running: ${label}`);
  const result = await runCommand(command, args, { env: commonEnv });
  if (result.code !== 0) {
    const message = `${label} failed in ${formatDuration(result.durationMs)} (exit code ${result.code}).`;
    if (optional) {
      warn(`${message} Continuing because step is optional.\n${result.stderr || result.stdout}`);
      await runCommandsSequentially(index + 1);
      return;
    }
    throw new Error(`${message}\n${result.stderr || result.stdout}`);
  }

  success(`${label} completed in ${formatDuration(result.durationMs)}.`);
  await runCommandsSequentially(index + 1);
}

// Top-level await is unavailable in the CJS runtime that executes this script; fall back to promise chaining.
// eslint-disable-next-line unicorn/prefer-top-level-await
main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
