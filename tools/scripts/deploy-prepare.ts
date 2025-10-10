import { existsSync, statSync } from "node:fs";
import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { error, heading, info, parseFlags, repoRoot, runCommand, success, warn } from "./utils";

const { resolve } = path;

async function prepareDeploy(): Promise<void> {
  const flags = parseFlags(process.argv.slice(2));
  const includeMetrics = Boolean(flags.metrics);
  const timestamp = new Date().toISOString().replaceAll(/[.:]/g, "-");
  const outputRoot = resolve(repoRoot, "dist", "deploy");
  const targetDir = resolve(outputRoot, timestamp);
  const pruneOutDir = resolve(repoRoot, "out");

  heading("Deployment Preparation");
  info("Running turbo prune to produce minimal deployment bundle…");

  const pruneResult = await runCommand("pnpm", ["prune:deploy"]);
  if (pruneResult.code !== 0) {
    throw new Error("turbo prune failed. Review logs above.");
  }

  // eslint-disable-next-line security/detect-non-literal-fs-filename
  if (!existsSync(pruneOutDir) || !statSync(pruneOutDir).isDirectory()) {
    throw new Error(`Expected prune output at ${pruneOutDir}, but directory is missing.`);
  }

  // eslint-disable-next-line security/detect-non-literal-fs-filename
  await mkdir(outputRoot, { recursive: true });
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  await rename(pruneOutDir, targetDir);
  success(`Deployment bundle created at ${targetDir}`);

  if (includeMetrics) {
    info("Collecting build metrics for deployment report…");
    const metricsResult = await runCommand("pnpm", ["run", "metrics:build"]);
    if (metricsResult.code !== 0) {
      warn("Build metrics generation failed. Bundle still available, but metrics missing.");
    }
  }

  const manifest = {
    createdAt: new Date().toISOString(),
    sourceCommit: process.env.GIT_COMMIT_SHA ?? undefined,
    outputPath: targetDir,
    includeMetrics,
  };
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  await writeFile(
    resolve(targetDir, "deploy-manifest.json"),
    `${JSON.stringify(manifest, undefined, 2)}\n`,
  );
  success("Deployment manifest generated.");

  // Clean up potential temporary out dir if turbo recreated it during metrics.
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  if (existsSync(pruneOutDir)) {
    await rm(pruneOutDir, { recursive: true, force: true });
  }
}

try {
  await prepareDeploy();
} catch (error_) {
  error(`Deployment preparation failed: ${(error_ as Error).stack ?? (error_ as Error).message}`);
  process.exitCode = 1;
}
