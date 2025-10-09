#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, sep } from "node:path";

const isWindows = process.platform === "win32";
const command = isWindows ? "pnpm.cmd" : "pnpm";
const args = ["exec", "turbo", "run", "build", "--summarize", "--no-daemon"];

if (process.argv.includes("--force")) {
  args.push("--force");
}

const result = spawnSync(command, args, {
  cwd: resolve(process.cwd()),
  encoding: "utf8",
  stdio: ["ignore", "pipe", "pipe"]
});

const combinedOutput = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
const summaryMatch = combinedOutput.match(/Summary:\s+(.+\.json)/);

if (!summaryMatch) {
  console.error("Unable to locate turbo summary file in output.");
  console.error(combinedOutput);
  process.exit(result.status ?? 1);
}

const summaryPath = summaryMatch[1].trim();
let summary;

try {
  summary = JSON.parse(readFileSync(summaryPath, "utf8"));
} catch (error) {
  console.error(`Failed to read turbo summary at ${summaryPath}:`, error);
  process.exit(1);
}

const durationMs =
  (summary.execution?.endTime ?? 0) - (summary.execution?.startTime ?? 0);

const metrics = {
  generatedAt: new Date().toISOString(),
  turboVersion: summary.turboVersion,
  runId: summary.id,
  success: summary.execution?.exitCode === 0,
  durationMs,
  attemptedTasks: summary.execution?.attempted ?? summary.tasks?.length ?? 0,
  cachedTasks: summary.execution?.cached ?? 0,
  failedTasks: summary.execution?.failed ?? 0,
  tasks: (summary.tasks ?? []).map((task) => ({
    taskId: task.taskId,
    package: task.package,
    command: task.command,
    durationMs:
      (task.execution?.endTime ?? 0) - (task.execution?.startTime ?? 0),
    cacheStatus: task.cache?.status ?? "UNKNOWN",
    exitCode: task.execution?.exitCode ?? 0
  }))
};

const reportDir = resolve(process.cwd(), "reports", "performance");
mkdirSync(reportDir, { recursive: true });
const outputPath = resolve(reportDir, "build-metrics.json");
writeFileSync(outputPath, JSON.stringify(metrics, null, 2));

const relativeSummaryPath = summaryPath.startsWith(process.cwd())
  ? summaryPath.slice(process.cwd().length + 1).split(sep).join("/")
  : summaryPath;

console.log(
  `Build metrics written to ${outputPath} (source summary: ${relativeSummaryPath}).`
);

if (!metrics.success) {
  console.error("Build completed with failures. Review metrics for details.");
  process.exit(result.status ?? 1);
}
