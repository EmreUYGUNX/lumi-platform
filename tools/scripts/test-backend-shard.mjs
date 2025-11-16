#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import process from "node:process";

const GROUPS = {
  core: [
    "src/webhooks",
    "src/modules/media",
    "src/modules/auth",
    "src/security",
    "src/queues",
  ],
  commerce: ["src/modules/order", "src/modules/cart", "src/modules/product", "src/modules/payment"],
  platform: ["src/lib", "src/middleware", "src/testing", "src/observability", "src/modules/user"],
};

const runCommand = (args) => {
  const result = spawnSync(args[0], args.slice(1), { stdio: "inherit" });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
};

const resolveGroup = () => {
  const requested = process.argv[2] || process.env.CI_PART || "core";
  const patterns = GROUPS[requested];
  if (!patterns) {
    console.error(`Unknown coverage shard "${requested}". Available: ${Object.keys(GROUPS).join(", ")}`);
    process.exit(1);
  }
  return { name: requested, patterns };
};

const main = () => {
  const { name, patterns } = resolveGroup();
  console.log(`Running backend coverage shard: ${name}`);

  const jestArgs = patterns.flatMap((pattern) => ["--testPathPattern", pattern]);
  runCommand([
    "pnpm",
    "--filter",
    "@lumi/backend",
    "run",
    "test:jest",
    "--",
    "--coverage",
    ...jestArgs,
  ]);
};

main();
