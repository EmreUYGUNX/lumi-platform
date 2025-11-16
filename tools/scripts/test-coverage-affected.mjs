#!/usr/bin/env node
import { spawnSync, execSync } from "node:child_process";
import process from "node:process";

const BASE_REF = process.env.COVERAGE_BASE_REF || "origin/main";
const BACKEND_SRC_PATH = "apps/backend/src";

const runCommand = (command, args) => {
  const result = spawnSync(command, args, { stdio: "inherit" });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
};

const runFullCoverage = () => {
  console.log("⚠️  Falling back to full backend coverage run.");
  runCommand("pnpm", ["--filter", "@lumi/backend", "run", "test:jest", "--", "--coverage"]);
};

const collectChangedFiles = () => {
  try {
    const output = execSync(`git diff --name-only ${BASE_REF} -- ${BACKEND_SRC_PATH}`, {
      encoding: "utf8",
    }).trim();

    if (!output) {
      return [];
    }

    return output
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
  } catch (error) {
    console.warn("Unable to determine changed files. Reason:", error.message);
    return [];
  }
};

const main = () => {
  const changedFiles = collectChangedFiles();
  if (changedFiles.length === 0) {
    console.log("No backend src changes detected.");
    runFullCoverage();
    return;
  }

  const relatedSources = changedFiles.filter(
    (file) =>
      file.endsWith(".ts") ||
      file.endsWith(".tsx") ||
      file.endsWith(".js") ||
      file.endsWith(".jsx"),
  );

  if (relatedSources.length === 0) {
    console.log("Changed backend files do not include executable sources.");
    runFullCoverage();
    return;
  }

  console.log("Running related coverage for files:");
  relatedSources.forEach((file) => console.log(` • ${file}`));

  runCommand("pnpm", [
    "--filter",
    "@lumi/backend",
    "run",
    "test:jest",
    "--",
    "--coverage",
    "--findRelatedTests",
    ...relatedSources,
  ]);
};

main();
