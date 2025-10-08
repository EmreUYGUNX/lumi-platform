#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
const lockfilePath = path.join(repoRoot, "pnpm-lock.yaml");
const allowedPatterns = [
  /^@babel\//,
  /^@esbuild\//,
  /^ajv$/,
  /^ansi-/,
  /^argparse$/,
  /^aria-query$/,
  /^brace-expansion$/,
  /^chalk$/,
  /^camelcase$/,
  /^ci-info$/,
  /^cssom$/,
  /^debug$/,
  /^doctrine$/,
  /^dom-accessibility-api$/,
  /^emoji-regex$/,
  /^esbuild$/,
  /^escape-string-regexp$/,
  /^execa$/,
  /^find-up$/,
  /^glob/,
  /^glob-parent$/,
  /^globals$/,
  /^get-stream$/,
  /^hosted-git-info$/,
  /^human-signals$/,
  /^is-fullwidth-code-point$/,
  /^is-stream$/,
  /^jackspeak$/,
  /^js-tokens$/,
  /^istanbul-lib-instrument$/,
  /^istanbul-lib-source-maps$/,
  /^js-yaml$/,
  /^jsesc$/,
  /^json-parse-even-better-errors$/,
  /^json-schema-traverse$/,
  /^json5$/,
  /^locate-path$/,
  /^lru-cache$/,
  /^mimic-fn$/,
  /^minimatch$/,
  /^normalize-package-data$/,
  /^npm-run-path$/,
  /^onetime$/,
  /^pngjs$/,
  /^p-limit$/,
  /^p-locate$/,
  /^path-exists$/,
  /^path-key$/,
  /^pathe$/,
  /^picomatch$/,
  /^postcss$/,
  /^pretty-format$/,
  /^react-is$/,
  /^resolve$/,
  /^resolve-from$/,
  /^rimraf$/,
  /^semver$/,
  /^signal-exit$/,
  /^source-map$/,
  /^slice-ansi$/,
  /^string-width$/,
  /^strip-ansi$/,
  /^strip-bom$/,
  /^strip-final-newline$/,
  /^supports-color$/,
  /^type-fest$/,
  /^type-detect$/,
  /^wrap-ansi$/,
  /^yocto-queue$/,
];

async function main() {
  let raw;
  try {
    raw = await readFile(lockfilePath, "utf8");
  } catch (error) {
    console.error("Failed to read pnpm-lock.yaml:", error.message);
    process.exit(1);
  }

  const lockfile = parse(raw);
  const packages = lockfile?.packages ?? {};
  const versionMap = new Map();

  for (const key of Object.keys(packages)) {
    if (!key) continue;
    const normalized = key.trim();
    const lastAt = normalized.lastIndexOf("@");
    if (lastAt <= 0) continue;
    const name = normalized.slice(0, lastAt);
    const rawVersion = normalized.slice(lastAt + 1).split("(")[0];
    if (!versionMap.has(name)) {
      versionMap.set(name, new Set());
    }
    versionMap.get(name).add(rawVersion);
  }

  const duplicates = Array.from(versionMap.entries())
    .filter(([, versions]) => versions.size > 1)
    .map(([name, versions]) => ({
      name,
      versions: Array.from(versions).sort((a, b) => a.localeCompare(b)),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  if (duplicates.length === 0) {
    console.log("✅ No duplicate dependency versions detected.");
    return;
  }

  const allowed = [];
  const unexpected = [];

  for (const dup of duplicates) {
    if (allowedPatterns.some((pattern) => pattern.test(dup.name))) {
      allowed.push(dup);
    } else {
      unexpected.push(dup);
    }
  }

  if (allowed.length > 0) {
    console.warn("⚠️ Allowed duplicate versions detected (review when updating dependencies):");
    for (const dup of allowed) {
      console.warn(`  • ${dup.name}: ${dup.versions.join(", ")}`);
    }
  }

  if (unexpected.length === 0) {
    console.log("✅ No unexpected duplicate dependency versions detected.");
    return;
  }

  console.error("❌ Unexpected duplicate dependency versions detected:");
  for (const dup of unexpected) {
    console.error(`  • ${dup.name}: ${dup.versions.join(", ")}`);
  }
  process.exitCode = 1;
}

await main();
