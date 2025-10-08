#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
const npmrcPath = path.join(repoRoot, ".npmrc");

const requiredSettings = {
  "strict-peer-dependencies": "true",
  "auto-install-peers": "false",
};

async function main() {
  let raw;
  try {
    raw = await readFile(npmrcPath, "utf8");
  } catch (error) {
    console.error("Failed to read .npmrc:", error.message);
    process.exit(1);
  }

  const configEntries = new Map();
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const [key, ...rest] = trimmed.split("=");
    if (!key) continue;
    configEntries.set(key.trim(), rest.join("=").trim());
  }

  const violations = [];
  for (const [key, expected] of Object.entries(requiredSettings)) {
    const actual = configEntries.get(key);
    if (actual !== expected) {
      violations.push({ key, expected, actual: actual ?? "<missing>" });
    }
  }

  if (violations.length === 0) {
    console.log("✅ Peer dependency enforcement settings are correctly configured.");
    return;
  }

  console.error("❌ Peer dependency enforcement misconfiguration detected:");
  for (const issue of violations) {
    console.error(`  • ${issue.key}: expected \"${issue.expected}\" but found \"${issue.actual}\"`);
  }
  process.exit(1);
}

await main();
