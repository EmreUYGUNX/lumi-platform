#!/usr/bin/env node
import { spawnSync } from "node:child_process";

const steps = [
  {
    label: "Secret scan (secretlint)",
    command: "pnpm",
    args: ["exec", "secretlint", "--maskSecrets", "**/*"],
  },
  {
    label: "Dependency audit",
    command: "pnpm",
    args: ["run", "audit:security"],
  },
];

function runStep(step) {
  const result = spawnSync(step.command, step.args, {
    stdio: "inherit",
    shell: false,
  });

  if (result.status !== 0) {
    throw new Error(`${step.label} failed with exit code ${result.status}`);
  }
}

try {
  steps.forEach((step) => {
    runStep(step);
  });
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
