#!/usr/bin/env node
/* eslint-disable no-console */
const { readFileSync, writeFileSync, unlinkSync, mkdirSync, rmSync } = require("node:fs");
const { spawnSync } = require("node:child_process");
const { join, extname } = require("node:path");

const files = process.argv.slice(2);

if (files.length === 0) {
  process.exit(0);
}

const tempDir = join(process.cwd(), ".secretlint-tmp");
mkdirSync(tempDir, { recursive: true });

files.forEach((file, index) => {
  try {
    const content = readFileSync(file, "utf8");
    const tempFile = join(tempDir, `secretlint-${Date.now()}-${index}${extname(file) || ".txt"}`);
    writeFileSync(tempFile, content, "utf8");

    const result = spawnSync(
      "pnpm",
      ["exec", "secretlint", "--maskSecrets", "--no-error-on-unmatched-pattern", tempFile],
      {
        stdio: ["inherit", "inherit", "inherit"],
      },
    );
    unlinkSync(tempFile);
    if (result.status !== 0) {
      process.exit(result.status ?? 1);
    }
  } catch (error) {
    console.error(`[secretlint] Failed to process ${file}:`, error?.message ?? error);
    process.exit(1);
  }
});

rmSync(tempDir, { recursive: true, force: true });
process.exit(0);
