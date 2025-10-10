/* eslint-disable security/detect-object-injection */
import { copyFileSync, existsSync } from "node:fs";
import path from "node:path";

import {
  confirm,
  error,
  heading,
  info,
  parseFlags,
  repoRoot,
  runCommand,
  success,
  warn,
} from "./utils";

const { resolve } = path;

interface Step {
  name: string;
  enabled: boolean;
  run: () => Promise<void>;
}

const flags = parseFlags(process.argv.slice(2));

const skipDoctor = Boolean(flags["skip-doctor"]);
const skipInstall = Boolean(flags["skip-install"]);
const skipVerify = Boolean(flags["skip-verify"]);
const autoApprove = Boolean(flags.yes || flags.y);

function getEnvTarget(): string {
  return resolve(repoRoot, ".env");
}

async function ensureEnvironmentFile(): Promise<void> {
  const envTarget = getEnvTarget();
  const templatePath = resolve(repoRoot, ".env.template");

  // eslint-disable-next-line security/detect-non-literal-fs-filename
  if (existsSync(envTarget)) {
    info(".env already exists – skipping template copy.");
    return;
  }

  // eslint-disable-next-line security/detect-non-literal-fs-filename
  if (!existsSync(templatePath)) {
    warn("No .env.template found. Skipping environment bootstrap.");
    return;
  }

  const shouldCopy = autoApprove || (await confirm("Copy .env.template to .env?"));
  if (!shouldCopy) {
    warn("Environment template copy skipped by user.");
    return;
  }

  // eslint-disable-next-line security/detect-non-literal-fs-filename
  copyFileSync(templatePath, envTarget);
  success("Created .env from template.");
}

function buildSteps(autoConfirm: boolean): Step[] {
  return [
    {
      name: "Environment diagnostics",
      enabled: !skipDoctor,
      run: async () => {
        const result = await runCommand("pnpm", ["run", "doctor"]);
        if (result.code !== 0) {
          throw new Error("Doctor checks failed. Resolve issues and re-run setup.");
        }
      },
    },
    {
      name: "Copy environment template",
      enabled: true,
      run: ensureEnvironmentFile,
    },
    {
      name: "Install dependencies",
      enabled: !skipInstall,
      run: async () => {
        const proceed =
          autoConfirm ||
          (await confirm("Run pnpm install? This may re-download dependencies.", true));
        if (!proceed) {
          warn("Dependency installation skipped on request.");
          return;
        }
        const result = await runCommand("pnpm", ["install"], { suppressOutput: false });
        if (result.code !== 0) {
          throw new Error("pnpm install failed. Check logs above.");
        }
      },
    },
    {
      name: "Workspace verification",
      enabled: !skipVerify,
      run: async () => {
        const proceed =
          autoConfirm || (await confirm("Run verify workflow (lint/typecheck/tests)?", true));
        if (!proceed) {
          warn("Verification workflow skipped on request.");
          return;
        }
        const result = await runCommand("pnpm", ["run", "verify:workspace"]);
        if (result.code !== 0) {
          throw new Error("Workspace verification failed.");
        }
      },
    },
  ];
}

async function runSetup(): Promise<void> {
  heading("Lumi Workspace Setup");
  info("Starting bootstrap for new developer environment.");

  const steps = buildSteps(autoApprove);

  await executeStepsSequentially(
    steps.filter((step) => {
      if (!step.enabled) {
        info(`Skipping: ${step.name}`);
        return false;
      }
      return true;
    }),
  );

  heading("Setup Finished");
  success("Workspace ready. Run `pnpm dev` to start development services.");
}

async function executeStepsSequentially(activeSteps: Step[], index = 0): Promise<void> {
  if (index >= activeSteps.length) {
    return;
  }

  const step = activeSteps[index];
  info(`➡️  ${step.name}`);
  try {
    await step.run();
    success(`${step.name} complete.`);
    await executeStepsSequentially(activeSteps, index + 1);
  } catch (error_) {
    error(`${step.name} failed: ${(error_ as Error).message}`);
    info("Setup halted. Resolve issues and re-run the script.");
    throw error_;
  }
}

try {
  await runSetup();
} catch (error_) {
  error(`Setup script crashed: ${(error_ as Error).stack ?? (error_ as Error).message}`);
  process.exitCode = 1;
}
