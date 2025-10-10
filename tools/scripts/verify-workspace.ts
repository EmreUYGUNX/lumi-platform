/* eslint-disable security/detect-object-injection, sonarjs/no-nested-template-literals */
import { error, formatDuration, heading, info, parseFlags, runCommand, success } from "./utils";

interface Task {
  name: string;
  command: string[];
  skipFlag?: string;
  optional?: boolean;
}

interface TaskResult {
  task: Task;
  status: "PASS" | "FAIL" | "SKIP";
  durationMs: number;
  output?: string;
}

const tasks: Task[] = [
  { name: "Code formatting check", command: ["pnpm", "format"], skipFlag: "skip-format" },
  { name: "Lint", command: ["pnpm", "lint"], skipFlag: "skip-lint" },
  { name: "Typecheck", command: ["pnpm", "typecheck"], skipFlag: "skip-types" },
  { name: "Unit tests", command: ["pnpm", "test"], skipFlag: "skip-tests" },
  { name: "Secret scan", command: ["pnpm", "security:secrets"], skipFlag: "skip-secrets" },
  {
    name: "Duplicate dependency scan",
    command: ["pnpm", "deps:duplicates"],
    skipFlag: "skip-deps",
  },
  { name: "Peer dependency scan", command: ["pnpm", "deps:peers"], skipFlag: "skip-deps" },
  {
    name: "Security audit",
    command: ["pnpm", "audit:security"],
    optional: true,
    skipFlag: "skip-audit",
  },
  {
    name: "Build metrics",
    command: ["pnpm", "run", "metrics:build"],
    optional: true,
    skipFlag: "skip-metrics",
  },
];

function shouldSkip(task: Task, flags: Record<string, string | boolean>): boolean {
  return Boolean(task.skipFlag && flags[task.skipFlag]);
}

async function executeTask(
  task: Task,
  flags: Record<string, string | boolean>,
): Promise<TaskResult> {
  if (shouldSkip(task, flags)) {
    info(`Skipping ${task.name}${task.skipFlag ? ` (flag --${task.skipFlag})` : ""}`);
    return { task, status: "SKIP", durationMs: 0 };
  }

  info(`➡️  ${task.name}`);
  const result = await runCommand(task.command[0], task.command.slice(1));
  const status: TaskResult["status"] = result.code === 0 ? "PASS" : "FAIL";
  if (status === "PASS") {
    success(`${task.name} completed in ${formatDuration(result.durationMs)}.`);
  } else {
    const optionalSuffix = task.optional ? " (optional task)" : "";
    const message = `${task.name} failed${optionalSuffix}.`;
    error(message);
  }

  return {
    task,
    status,
    durationMs: result.durationMs,
    output: result.stdout || result.stderr,
  };
}

function statusIndicator(status: TaskResult["status"]): string {
  switch (status) {
    case "PASS": {
      return "✅";
    }
    case "SKIP": {
      return "⚠️";
    }
    default: {
      return "❌";
    }
  }
}

function printSummary(results: TaskResult[]): void {
  heading("Verification Summary");
  results.forEach((result) => {
    const components = [statusIndicator(result.status), result.task.name];
    if (result.durationMs) {
      components.push(`(${formatDuration(result.durationMs)})`);
    }
    info(components.join(" "));
  });
}

async function verify(): Promise<void> {
  heading("Workspace Verification");
  const flags = parseFlags(process.argv.slice(2));
  const results = await executeTasksSequentially(tasks, flags);
  printSummary(results);
  success("All verification tasks completed successfully.");
}

try {
  await verify();
} catch (error_) {
  error(`Verification script crashed: ${(error_ as Error).stack ?? (error_ as Error).message}`);
  process.exitCode = 1;
}

async function executeTasksSequentially(
  taskList: Task[],
  flags: Record<string, string | boolean>,
  index = 0,
  accumulator: TaskResult[] = [],
): Promise<TaskResult[]> {
  if (index >= taskList.length) {
    return accumulator;
  }

  const task = taskList[index];
  const outcome = await executeTask(task, flags);
  accumulator.push(outcome);

  if (outcome.status === "FAIL" && !task.optional) {
    printSummary(accumulator);
    throw new Error("Workspace verification failed. Review logs above.");
  }

  return executeTasksSequentially(taskList, flags, index + 1, accumulator);
}
