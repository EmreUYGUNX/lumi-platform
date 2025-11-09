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
  /^@colors\/colors$/,
  /^@esbuild\//,
  /^@grpc\/proto-loader$/,
  /^@prisma\/debug$/,
  /^@stoplight\/types$/,
  /^@stoplight\/yaml$/,
  /^@stoplight\/yaml-ast-parser$/,
  /^@types\/connect$/,
  /^@types\/estree$/,
  /^@types\/node$/,
  /^@types\/send$/,
  /^@types\/ssh2$/,
  /^ajv$/,
  /^agent-base$/,
  /^ansi-/,
  /^argparse$/,
  /^aria-query$/,
  /^@floating-ui\/react$/,
  /^ast-types$/,
  /^brace-expansion$/,
  /^buffer$/,
  /^buffer-crc32$/,
  /^camelcase$/,
  /^chalk$/,
  /^chokidar$/,
  /^ci-info$/,
  /^cliui$/,
  /^color-convert$/,
  /^color-name$/,
  /^cookie-signature$/,
  /^commander$/,
  /^confbox$/,
  /^cose-base$/,
  /^cssom$/,
  /^d3-/,
  /^data-uri-to-buffer$/,
  /^debug$/,
  /^doctrine$/,
  /^dom-accessibility-api$/,
  /^emoji-regex$/,
  /^entities$/,
  /^encodeurl$/,
  /^esbuild$/,
  /^escape-string-regexp$/,
  /^estree-walker$/,
  /^execa$/,
  /^fast-glob$/,
  /^find-up$/,
  /^get-stream$/,
  /^glob/,
  /^glob-parent$/,
  /^globals$/,
  /^hosted-git-info$/,
  /^has-flag$/,
  /^http-proxy-agent$/,
  /^https-proxy-agent$/,
  /^human-signals$/,
  /^iconv-lite$/,
  /^ignore$/,
  /^immer$/,
  /^internmap$/,
  /^is-fullwidth-code-point$/,
  /^is-stream$/,
  /^isarray$/,
  /^jackspeak$/,
  /^jiti$/,
  /^js-tokens$/,
  /^istanbul-lib-instrument$/,
  /^istanbul-lib-source-maps$/,
  /^js-yaml$/,
  /^jsesc$/,
  /^json-parse-even-better-errors$/,
  /^json-schema-traverse$/,
  /^json5$/,
  /^jsonpath-plus$/,
  /^layout-base$/,
  /^media-typer$/,
  /^lines-and-columns$/,
  /^locate-path$/,
  /^local-pkg$/,
  /^lru-cache$/,
  /^magic-string$/,
  /^marked$/,
  /^mime-types$/,
  /^mime$/,
  /^mime-db$/,
  /^mimic-fn$/,
  /^minimatch$/,
  /^ms$/,
  /^negotiator$/,
  /^normalize-package-data$/,
  /^npm-run-path$/,
  /^onetime$/,
  /^p-limit$/,
  /^p-locate$/,
  /^pako$/,
  /^parse-json$/,
  /^path-exists$/,
  /^path-key$/,
  /^path-type$/,
  /^pathe$/,
  /^picomatch$/,
  /^pkg-types$/,
  /^pluralize$/,
  /^pngjs$/,
  /^postcss$/,
  /^pretty-format$/,
  /^qs$/,
  /^react$/,
  /^react-is$/,
  /^readdirp$/,
  /^read-pkg$/,
  /^read-pkg-up$/,
  /^readable-stream$/,
  /^resolve-from$/,
  /^resolve$/,
  /^rimraf$/,
  /^rollup$/,
  /^safe-buffer$/,
  /^safe-stable-stringify$/,
  /^scheduler$/,
  /^semver$/,
  /^signal-exit$/,
  /^slash$/,
  /^slice-ansi$/,
  /^source-map$/,
  /^string-width$/,
  /^string_decoder$/,
  /^strip-ansi$/,
  /^strip-bom$/,
  /^strip-final-newline$/,
  /^statuses$/,
  /^supports-color$/,
  /^tar-fs$/,
  /^tar-stream$/,
  /^tr46$/,
  /^tslib$/,
  /^type-detect$/,
  /^type-is$/,
  /^type-fest$/,
  /^undici-types$/,
  /^unicorn-magic$/,
  /^universalify$/,
  /^uuid$/,
  /^webidl-conversions$/,
  /^wrap-ansi$/,
  /^whatwg-url$/,
  /^ws$/,
  /^yargs$/,
  /^yaml$/,
  /^yocto-queue$/,
  /^zod$/,
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
    const cleanedName = name.startsWith("/") ? name.slice(1) : name;
    const rawVersion = normalized.slice(lastAt + 1).split("(")[0];
    if (!versionMap.has(cleanedName)) {
      versionMap.set(cleanedName, new Set());
    }
    versionMap.get(cleanedName).add(rawVersion);
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
