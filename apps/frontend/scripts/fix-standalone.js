/* eslint-disable @typescript-eslint/no-require-imports */
/* eslint-disable unicorn/prefer-top-level-await */
// Ensure the standalone output contains dependencies the runtime expects.
// Next.js tracing occasionally omits the ESM helpers and a route-level manifest,
// so we copy them explicitly after the build.
const fs = require("node:fs");
const fsPromises = require("node:fs/promises");
const path = require("node:path");

const appRoot = path.join(__dirname, "..");
const standaloneRoot = path.join(appRoot, ".next", "standalone");

const helpersPackagePath = require.resolve("@swc/helpers/package.json", { paths: [appRoot] });
const sourceHelpers = path.join(path.dirname(helpersPackagePath), "esm");
const targetHelpers = path.join(standaloneRoot, "node_modules", "@swc", "helpers", "esm");

const sourceManifest = path.join(
  standaloneRoot,
  "apps",
  "frontend",
  ".next",
  "server",
  "app",
  "page_client-reference-manifest.js",
);
const targetManifest = path.join(
  standaloneRoot,
  "apps",
  "frontend",
  ".next",
  "server",
  "app",
  "(public)",
  "page_client-reference-manifest.js",
);

async function copyIfExists(sourcePath, destinationPath, options) {
  const copyOptions = options ?? { recursive: true };
  if (!fs.existsSync(sourcePath)) {
    console.warn(`[fix-standalone] Source missing, skipping: ${sourcePath}`);
    return;
  }
  await fsPromises.mkdir(path.dirname(destinationPath), { recursive: true });
  await fsPromises.cp(sourcePath, destinationPath, copyOptions);
  console.info(`[fix-standalone] Copied ${sourcePath} -> ${destinationPath}`);
}

async function main() {
  await copyIfExists(sourceHelpers, targetHelpers);
  await copyIfExists(sourceManifest, targetManifest, { recursive: false });
}

main().catch((error) => {
  console.error("[fix-standalone] Postbuild copy failed", error);
  process.exitCode = 1;
});
