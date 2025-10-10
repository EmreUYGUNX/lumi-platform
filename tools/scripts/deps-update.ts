import { error, heading, info, parseFlags, runCommand, success, warn } from "./utils";

type Mode = "conservative" | "minor" | "latest";

async function main(): Promise<void> {
  const flags = parseFlags(process.argv.slice(2));
  const mode = determineMode(flags);
  const interactive = Boolean(flags.interactive);
  const reportOnly = Boolean(flags.report);

  heading("Dependency Update Workflow");
  info(`Mode: ${mode}${interactive ? " (interactive)" : ""}`);

  if (reportOnly) {
    await generateReport();
    return;
  }

  await performUpdate(mode, interactive);
  await runPostUpdateValidation();
}

try {
  await main();
} catch (error_) {
  error(
    `Dependency update workflow failed: ${(error_ as Error).stack ?? (error_ as Error).message}`,
  );
  process.exitCode = 1;
}

function determineMode(flags: Record<string, string | boolean>): Mode {
  const value = typeof flags.mode === "string" ? flags.mode : undefined;
  if (value === "minor") return "minor";
  if (value === "latest" || value === "major") return "latest";
  return "conservative";
}

async function generateReport(): Promise<void> {
  info("Generating dependency update report via npm-check-updates…");
  const report = await runCommand("pnpm", [
    "dlx",
    "npm-check-updates",
    "--deep",
    "--format",
    "group",
  ]);
  if (report.stdout) {
    // eslint-disable-next-line no-console
    console.log(report.stdout);
  }
  if (report.code !== 0) {
    throw new Error("npm-check-updates encountered an error.");
  }
  success("Report generated.");
}

async function performUpdate(mode: Mode, interactive: boolean): Promise<void> {
  const args = ["update", "--recursive"];
  if (mode === "minor") {
    args.push("--latest-matching");
  } else if (mode === "latest") {
    args.push("--latest");
  }
  if (interactive) {
    args.push("--interactive");
  }

  const updateResult = await runCommand("pnpm", args);
  if (updateResult.code !== 0) {
    throw new Error("pnpm update failed. Review logs above.");
  }

  success("pnpm update completed.");
}

async function runPostUpdateValidation(): Promise<void> {
  info("Running security audit to validate updated dependencies…");
  const auditResult = await runCommand("pnpm", ["audit:security"]);
  if (auditResult.code === 0) {
    success("Security audit passed.");
  } else {
    warn("Security audit reported issues. Address findings before committing.");
  }

  info("Refreshing duplicate dependency report…");
  const dupResult = await runCommand("pnpm", ["deps:duplicates"]);
  if (dupResult.code === 0) {
    success("Duplicate dependency report clean.");
  } else {
    warn("Duplicate dependency script detected issues. Review output above.");
  }
}
