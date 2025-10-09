#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const command = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const args = ["exec", "turbo", "run", "dev", "--dry-run=json", "--no-daemon"];

const result = spawnSync(command, args, {
  cwd: resolve(process.cwd()),
  encoding: "utf8",
  stdio: ["ignore", "pipe", "pipe"]
});

if (result.error) {
  console.error("Failed to execute turbo dry run:", result.error);
  process.exitCode = 1;
  process.exit();
}

if (result.status !== 0) {
  console.error(result.stderr.trim() || "turbo dry run exited with a non-zero status.");
  process.exit(result.status ?? 1);
}

const stdout = result.stdout ?? "";
const jsonStartIndex = stdout.indexOf("{");

if (jsonStartIndex === -1) {
  console.error("Unable to locate JSON payload in turbo dry run output.");
  process.exit(1);
}

const payload = stdout.slice(jsonStartIndex);
let dryRun;

try {
  dryRun = JSON.parse(payload);
} catch (error) {
  console.error("Failed to parse turbo dry run payload:", error);
  process.exit(1);
}

const packageSummaries = new Map();
let persistentTasks = 0;
let cacheHits = 0;
let cacheMisses = 0;

for (const task of dryRun.tasks ?? []) {
  const summary = packageSummaries.get(task.package) ?? {
    package: task.package,
    taskCount: 0,
    persistent: 0,
    dependencies: new Set()
  };

  summary.taskCount += 1;

  if (task.resolvedTaskDefinition?.persistent) {
    summary.persistent += 1;
    persistentTasks += 1;
  }

  for (const dependency of task.dependencies ?? []) {
    summary.dependencies.add(dependency);
  }

  if (task.cache?.status === "HIT") {
    cacheHits += 1;
  } else if (task.cache?.status === "MISS") {
    cacheMisses += 1;
  }

  packageSummaries.set(task.package, summary);
}

const metrics = {
  generatedAt: new Date().toISOString(),
  turboVersion: dryRun.turboVersion,
  totalPackages: dryRun.packages?.length ?? 0,
  totalTasks: dryRun.tasks?.length ?? 0,
  persistentTasks,
  cache: {
    hits: cacheHits,
    misses: cacheMisses
  },
  packages: Array.from(packageSummaries.values()).map((summary) => ({
    package: summary.package,
    taskCount: summary.taskCount,
    persistentTasks: summary.persistent,
    dependencyCount: summary.dependencies.size
  }))
};

const reportDir = resolve(process.cwd(), "reports", "performance");
mkdirSync(reportDir, { recursive: true });

const outputPath = resolve(reportDir, "dev-metrics.json");
writeFileSync(outputPath, JSON.stringify(metrics, null, 2));

console.log(`Dev performance metrics written to ${outputPath}`);
console.log(
  `Tracked ${metrics.totalTasks} tasks across ${metrics.totalPackages} packages (persistent: ${metrics.persistentTasks}, cache hits: ${metrics.cache.hits}, cache misses: ${metrics.cache.misses}).`
);
