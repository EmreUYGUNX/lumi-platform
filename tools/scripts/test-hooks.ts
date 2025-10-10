/* eslint-disable security/detect-object-injection, unicorn/prefer-top-level-await */
import { spawn } from "node:child_process";
import { performance } from "node:perf_hooks";

import {
  error,
  formatDuration,
  heading,
  info,
  parseFlags,
  repoRoot,
  runCommand,
  success,
  warn,
} from "./utils";

interface Task {
  name: string;
  skipFlag?: string;
  optional?: boolean;
  run: () => Promise<boolean>;
}

const tasks: Task[] = [
  {
    name: "lint-staged dry run",
    skipFlag: "skip-lint",
    run: async () => {
      const result = await runCommand("pnpm", [
        "exec",
        "lint-staged",
        "--config",
        "lint-staged.config.mjs",
        "--allow-empty",
        "--no-stash",
      ]);
      return result.code === 0;
    },
  },
  {
    name: "commitlint sample validation",
    skipFlag: "skip-commitlint",
    run: async () => {
      const sampleMessage = "feat(hooks): verify commitlint configuration\n\nRefs: SAMPLE-000";
      const status = await runCommitlint(sampleMessage);
      return status === 0;
    },
  },
  {
    name: "pre-push test command",
    skipFlag: "skip-tests",
    optional: true,
    run: async () => {
      const result = await runCommand("pnpm", ["test", "--", "--watch=false", "--bail"]);
      return result.code === 0;
    },
  },
];

async function runCommitlint(message: string): Promise<number> {
  const start = performance.now();
  return new Promise<number>((resolve) => {
    const child = spawn("pnpm", ["commitlint"], {
      cwd: repoRoot,
      stdio: ["pipe", "inherit", "inherit"],
    });

    child.stdin?.write(message);
    child.stdin?.end();

    child.on("close", (code) => {
      const duration = performance.now() - start;
      const outcome = code === 0 ? "passed" : "failed";
      info(`Commitlint sample ${outcome} in ${formatDuration(duration)}.`);
      resolve(code ?? 1);
    });
  });
}

async function main(): Promise<void> {
  heading("Git Hook Diagnostics");

  const flags = parseFlags(process.argv.slice(2));
  let failures = 0;

  // eslint-disable-next-line no-restricted-syntax
  for (const task of tasks) {
    if (task.skipFlag && flags[task.skipFlag]) {
      warn(`Skipping ${task.name} (flag --${task.skipFlag})`);
      // eslint-disable-next-line no-continue
      continue;
    }

    info(`▶️  ${task.name}`);
    // eslint-disable-next-line no-await-in-loop
    const passed = await task.run();
    if (passed) {
      success(`${task.name} succeeded.`);
    } else {
      failures += 1;
      const suffix = task.optional ? " (optional)" : "";
      error(`${task.name} failed${suffix}.`);
      if (!task.optional) {
        break;
      }
    }
  }

  if (failures > 0) {
    const message = `${failures} hook check(s) failed. Review logs above.`;
    throw new Error(message);
  }

  success("All hook diagnostics passed.");
}

(async () => {
  try {
    await main();
  } catch (error_) {
    error(error_ instanceof Error ? error_.message : String(error_));
    process.exitCode = 1;
  }
})();
