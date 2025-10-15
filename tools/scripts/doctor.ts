/* eslint-disable security/detect-object-injection */
import { existsSync, readFileSync } from "node:fs";
import { cpus, totalmem } from "node:os";
import path from "node:path";

import { error, formatDuration, heading, info, repoRoot, runCommand, success, warn } from "./utils";

const { resolve } = path;

type Status = "PASS" | "WARN" | "FAIL";

interface CheckResult {
  name: string;
  status: Status;
  details: string;
}

const MIN_NODE = "20.18.1";
const MIN_PNPM = "9.0.0";
const TURBO_TOKEN_WARNING = "TURBO_TOKEN not set. Remote cache disabled.";
const WARNING_SUFFIX = "warning(s) detected. Review before continuing.";

function normalizeVersion(value: string): number[] {
  return value
    .replace(/^v/, "")
    .split(".")
    .map((part) => Number.parseInt(part, 10));
}

function compareSemver(current: string, expected: string): number {
  const currentParts = normalizeVersion(current);
  const expectedParts = normalizeVersion(expected);
  const length = Math.max(currentParts.length, expectedParts.length);

  for (let index = 0; index < length; index += 1) {
    const a = currentParts.at(index) ?? 0;
    const b = expectedParts.at(index) ?? 0;
    if (a > b) return 1;
    if (a < b) return -1;
  }

  return 0;
}

async function checkNode(): Promise<CheckResult> {
  const current = process.versions.node;
  const comparison = compareSemver(current, MIN_NODE);
  const status: Status = comparison >= 0 ? "PASS" : "FAIL";
  const details =
    comparison >= 0 ? `v${current}` : `Detected v${current}. Expected >= v${MIN_NODE}`;
  return { name: "Node.js runtime", status, details };
}

async function checkPnpm(): Promise<CheckResult> {
  const result = await runCommand("pnpm", ["--version"], { suppressOutput: true });
  if (result.code !== 0) {
    return { name: "pnpm", status: "FAIL", details: result.stderr || "pnpm not available in PATH" };
  }

  const version = result.stdout;
  const comparison = compareSemver(version, MIN_PNPM);
  const status: Status = comparison >= 0 ? "PASS" : "FAIL";
  const details =
    comparison >= 0 ? `v${version}` : `Detected v${version}. Expected >= v${MIN_PNPM}`;

  return { name: "pnpm", status, details };
}

async function checkDocker(): Promise<CheckResult> {
  const result = await runCommand("docker", ["--version"], { suppressOutput: true });
  if (result.code !== 0) {
    return {
      name: "Docker",
      status: "WARN",
      details: "Docker CLI not found. Required for local services.",
    };
  }

  return {
    name: "Docker",
    status: "PASS",
    details: result.stdout.split(",")[0] ?? "Docker available",
  };
}

async function checkGit(): Promise<CheckResult> {
  const result = await runCommand("git", ["status"], { suppressOutput: true });
  if (result.code !== 0) {
    return { name: "Git", status: "FAIL", details: result.stderr || "Unable to run git" };
  }

  return { name: "Git", status: "PASS", details: "Repository status accessible" };
}

async function checkTurboToken(): Promise<CheckResult> {
  const hasToken = Boolean(process.env.TURBO_TOKEN);
  return hasToken
    ? { name: "Turbo remote cache token", status: "PASS", details: "TURBO_TOKEN detected" }
    : {
        name: "Turbo remote cache token",
        status: "WARN",
        details: TURBO_TOKEN_WARNING,
      };
}

async function checkEnvTemplates(): Promise<CheckResult> {
  const files = [".env.template", "env/.env.docker"];
  const missing = files.filter((relative) => {
    const candidate = resolve(repoRoot, relative);
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    return !existsSync(candidate);
  });
  if (missing.length === 0) {
    return { name: "Environment templates", status: "PASS", details: "All template files present" };
  }

  return {
    name: "Environment templates",
    status: "FAIL",
    details: `Missing: ${missing.join(", ")}`,
  };
}

async function checkCpuAndMemory(): Promise<CheckResult> {
  const totalMemoryGb = totalmem() / 1024 / 1024 / 1024;
  const cpuCount = cpus().length;
  const memoryStatus: Status = totalMemoryGb >= 8 ? "PASS" : "WARN";
  const cpuStatus: Status = cpuCount >= 4 ? "PASS" : "WARN";
  const priority = memoryStatus === "PASS" && cpuStatus === "PASS" ? "PASS" : "WARN";
  return {
    name: "Host resources",
    status: priority,
    details: `${cpuCount} CPUs, ${totalMemoryGb.toFixed(1)} GB RAM`,
  };
}

async function checkWorkspaceLock(): Promise<CheckResult> {
  const lockPath = resolve(repoRoot, "pnpm-lock.yaml");
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  if (!existsSync(lockPath)) {
    return {
      name: "pnpm-lock.yaml",
      status: "FAIL",
      details: "Lockfile missing. Run pnpm install.",
    };
  }

  // eslint-disable-next-line security/detect-non-literal-fs-filename
  const content = readFileSync(lockPath, "utf8");
  return content.includes("lockfileVersion")
    ? { name: "pnpm-lock.yaml", status: "PASS", details: "Lockfile present" }
    : { name: "pnpm-lock.yaml", status: "WARN", details: "Lockfile suspicious. Verify integrity." };
}

async function runDoctor(): Promise<void> {
  heading("Lumi Doctor");
  info(`Repository: ${repoRoot}`);

  const checks = [
    checkNode,
    checkPnpm,
    checkDocker,
    checkGit,
    checkTurboToken,
    checkEnvTemplates,
    checkCpuAndMemory,
    checkWorkspaceLock,
  ];

  const startedAt = Date.now();
  const results = await executeChecksSequentially(checks);

  // eslint-disable-next-line security/detect-object-injection
  const failures = results.filter((item) => item.status === "FAIL");
  // eslint-disable-next-line security/detect-object-injection
  const warnings = results.filter((item) => item.status === "WARN");

  if (failures.length === 0 && warnings.length === 0) {
    success("Environment ready for development.");
  } else {
    if (warnings.length > 0) {
      warn(`${warnings.length} ${WARNING_SUFFIX}`);
    }
    if (failures.length > 0) {
      throw new Error("Doctor detected blocking issues. Resolve failures and retry.");
    }
  }

  info("Doctor run completed.");
  info(`Checks executed in ${formatDuration(Date.now() - startedAt)}.`);
}

try {
  await runDoctor();
} catch (error_) {
  error(`Unexpected error: ${(error_ as Error).message}`);
  process.exitCode = 1;
}

async function executeChecksSequentially(
  checkFns: (() => Promise<CheckResult>)[],
  index = 0,
  accumulator: CheckResult[] = [],
): Promise<CheckResult[]> {
  if (index >= checkFns.length) {
    return accumulator;
  }

  const nextCheck = checkFns[index];
  const result = await nextCheck();
  accumulator.push(result);
  const prefix = result.status === "PASS" ? "✅" : result.status === "WARN" ? "⚠️" : "❌";
  // eslint-disable-next-line no-console
  console.log(`${prefix} ${result.name.padEnd(28, " ")} ${result.details}`);
  return executeChecksSequentially(checkFns, index + 1, accumulator);
}
