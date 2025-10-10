import { existsSync } from "node:fs";
import { rm } from "node:fs/promises";
import path from "node:path";

import { confirm, error, heading, info, parseFlags, repoRoot, success, warn } from "./utils";

const { resolve } = path;

interface Target {
  label: string;
  path: string;
  category: "base" | "build" | "modules" | "store";
}

const targets: Target[] = [
  { label: ".turbo cache", path: ".turbo", category: "base" },
  { label: "root coverage reports", path: "coverage", category: "base" },
  { label: "root dist output", path: "dist", category: "build" },
  { label: "root build output", path: "build", category: "build" },
  { label: "frontend Next.js cache", path: "apps/frontend/.next", category: "build" },
  { label: "frontend node_modules", path: "apps/frontend/node_modules", category: "modules" },
  { label: "backend dist output", path: "apps/backend/dist", category: "build" },
  { label: "backend node_modules", path: "apps/backend/node_modules", category: "modules" },
  { label: "mobile node_modules", path: "apps/mobile/node_modules", category: "modules" },
  { label: "packages/shared dist", path: "packages/shared/dist", category: "build" },
  { label: "packages/ui dist", path: "packages/ui/dist", category: "build" },
  { label: "packages/types dist", path: "packages/types/dist", category: "build" },
  { label: "packages/testing dist", path: "packages/testing/dist", category: "build" },
  { label: "workspace node_modules", path: "node_modules", category: "modules" },
  { label: "pnpm store", path: ".pnpm-store", category: "store" },
];

async function removeTarget(target: Target): Promise<boolean> {
  const absolutePath = resolve(repoRoot, target.path);
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  if (!existsSync(absolutePath)) {
    return false;
  }

  // eslint-disable-next-line security/detect-non-literal-fs-filename
  await rm(absolutePath, { recursive: true, force: true });
  success(`Removed ${target.label}`);
  return true;
}

function selectTargets(flags: Record<string, string | boolean>): Target[] {
  const full = Boolean(flags.full);
  const includeStore = Boolean(flags.store) || Boolean(flags["include-store"]);

  return targets.filter((target) => {
    switch (target.category) {
      case "modules": {
        return full;
      }
      case "store": {
        return includeStore || full;
      }
      default: {
        return true;
      }
    }
  });
}

async function run(): Promise<void> {
  const flags = parseFlags(process.argv.slice(2));
  const autoApprove = Boolean(flags.yes) || Boolean(flags.y);

  heading("Workspace Clean");

  const selected = selectTargets(flags);

  if (selected.length === 0) {
    info("No targets selected. Use --full to include node_modules or --store to purge pnpm store.");
    return;
  }

  info("Targets slated for removal:");
  selected.forEach((target) => info(` • ${target.label} (${target.path})`));

  const proceed =
    autoApprove ||
    (await confirm(
      "Continue and remove the selected directories? This operation is destructive.",
      false,
    ));

  if (!proceed) {
    warn("Cleanup aborted by user.");
    return;
  }

  const results = await Promise.all(
    selected.map(async (target) => {
      try {
        return await removeTarget(target);
      } catch (error_) {
        error(`Failed to remove ${target.label}: ${(error_ as Error).message}`);
        process.exitCode = 1;
        return false;
      }
    }),
  );

  const removed = results.filter(Boolean).length;

  if (removed === 0) {
    warn("No matching paths were found on disk.");
  } else {
    success(`Cleanup complete. ${removed} target(s) removed.`);
  }
}

try {
  await run();
} catch (error_) {
  error(`Cleanup script crashed: ${(error_ as Error).stack ?? (error_ as Error).message}`);
  process.exitCode = 1;
}
