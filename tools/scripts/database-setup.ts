import { existsSync } from "node:fs";
import path from "node:path";

import { error, heading, info, parseFlags, repoRoot, runCommand, success, warn } from "./utils";

const { resolve } = path;

type Action = "start" | "stop" | "restart" | "status";

const flags = parseFlags(process.argv.slice(2));

const action: Action = ((): Action => {
  if (flags.stop) return "stop";
  if (flags.restart) return "restart";
  if (flags.status) return "status";
  return "start";
})();

const services = ((): string[] => {
  const value = flags.services;
  if (typeof value === "string" && value.length > 0) {
    return value
      .split(",")
      .map((token) => token.trim())
      .filter(Boolean);
  }
  return ["postgres", "redis"];
})();

async function ensureDocker(): Promise<void> {
  const result = await runCommand("docker", ["info"], { suppressOutput: true });
  if (result.code !== 0) {
    throw new Error("Docker is not available. Install Docker Desktop or start the Docker daemon.");
  }
}

async function runDockerCompose(args: string[]): Promise<void> {
  const result = await runCommand("docker", ["compose", ...args]);
  if (result.code !== 0) {
    throw new Error(result.stderr || `docker compose ${args.join(" ")} failed`);
  }
}

async function runSeed(): Promise<void> {
  const seedScript = resolve(repoRoot, "apps/backend/scripts/seed.ts");
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  if (!existsSync(seedScript)) {
    warn(
      "No backend seed script found (expected apps/backend/scripts/seed.ts). Skipping seed step.",
    );
    return;
  }

  const result = await runCommand("pnpm", [
    "--filter",
    "@lumi/backend",
    "exec",
    "tsx",
    "scripts/seed.ts",
  ]);
  if (result.code !== 0) {
    throw new Error("Database seed failed. Check backend seed script output.");
  }
  success("Database seeded successfully.");
}

async function main(): Promise<void> {
  heading("Database & Cache Services");
  info(`Action: ${action.toUpperCase()}`);
  info(`Services: ${services.join(", ")}`);

  await ensureDocker();

  if (action === "status") {
    await runDockerCompose(["ps", ...services]);
    return;
  }

  if (action === "stop") {
    await runDockerCompose(["stop", ...services]);
    success("Services stopped.");
    return;
  }

  await (action === "restart"
    ? runDockerCompose(["restart", ...services])
    : runDockerCompose(["up", "-d", ...services]));

  success("Docker services are running.");

  if (flags.seed) {
    await runSeed();
  }

  if (flags.status || action === "restart") {
    await runDockerCompose(["ps", ...services]);
  }
}

try {
  await main();
} catch (error_) {
  error(`Database setup failed: ${(error_ as Error).message}`);
  process.exitCode = 1;
}
