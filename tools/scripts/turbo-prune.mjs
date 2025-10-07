#!/usr/bin/env node
/**
 * Pre-configured turbo prune helper for deployment bundles.
 */
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const scopes = process.env.PRUNE_SCOPES?.split(",").filter(Boolean) ?? [
  "@lumi/backend",
  "@lumi/frontend"
];

const args = [
  "prune",
  ...scopes.flatMap((scope) => ["--scope", scope]),
  "--include-dependencies",
  "--docker"
];

execFileSync("turbo", args, {
  stdio: "inherit",
  cwd: resolve(__dirname, "../../.."),
  env: process.env
});
