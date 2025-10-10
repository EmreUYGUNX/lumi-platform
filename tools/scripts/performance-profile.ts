import { mkdir } from "node:fs/promises";
import path from "node:path";

import { error, heading, info, parseFlags, repoRoot, runCommand, success } from "./utils";

const { resolve } = path;

async function main(): Promise<void> {
  const flags = parseFlags(process.argv.slice(2));
  const task = typeof flags.task === "string" ? flags.task : "build";
  const anonymous = Boolean(flags.anon);
  const timestamp = new Date().toISOString().replaceAll(/[.:]/g, "-");
  const profileDir = resolve(repoRoot, "profiles", "performance");
  const filename = `${timestamp}-${task}${anonymous ? "-anon" : ""}.json`;
  const profilePath = resolve(profileDir, filename);

  // eslint-disable-next-line security/detect-non-literal-fs-filename
  await mkdir(profileDir, { recursive: true });

  heading("Turbo Performance Profile");
  info(`Task: ${task}`);
  info(`Profile output: ${profilePath}`);

  const args = ["exec", "turbo", "run", task, "--no-daemon", "--profile", profilePath];
  if (anonymous) {
    args.push("--anon-profile", profilePath.replace(".json", "-anon.json"));
  }
  const result = await runCommand("pnpm", args);
  if (result.code !== 0) {
    throw new Error("Turbo profiling run failed. Check output above.");
  }

  success(`Profile recorded. Load ${profilePath} in chrome://tracing for analysis.`);
}

try {
  await main();
} catch (error_) {
  error(`Performance profiling failed: ${(error_ as Error).stack ?? (error_ as Error).message}`);
  process.exitCode = 1;
}
