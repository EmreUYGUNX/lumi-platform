/* eslint-disable security/detect-object-injection */
import { spawn } from "node:child_process";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";

const { dirname, resolve: resolvePath } = path;

export interface CommandResult {
  code: number | null;
  stdout: string;
  stderr: string;
  durationMs: number;
}

export interface RunCommandOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  suppressOutput?: boolean;
}

export const scriptsDir = dirname(fileURLToPath(import.meta.url));
export const repoRoot = resolvePath(scriptsDir, "..", "..");

export async function runCommand(
  command: string,
  args: string[],
  options: RunCommandOptions = {},
): Promise<CommandResult> {
  const start = performance.now();
  return new Promise<CommandResult>((resolve) => {
    const child = spawn(command, args, {
      cwd: options.cwd ?? repoRoot,
      env: { ...process.env, ...options.env },
      shell: process.platform === "win32",
      stdio: options.suppressOutput ? "pipe" : "inherit",
    });

    let stdout = "";
    let stderr = "";

    if (child.stdout) {
      child.stdout.on("data", (chunk) => {
        stdout += chunk.toString();
      });
    }

    if (child.stderr) {
      child.stderr.on("data", (chunk) => {
        stderr += chunk.toString();
      });
    }

    child.on("close", (code) => {
      resolve({
        code,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        durationMs: performance.now() - start,
      });
    });
  });
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms.toFixed(0)}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60_000).toFixed(1)}m`;
}

export async function confirm(prompt: string, defaultValue = false): Promise<boolean> {
  if (!process.stdout.isTTY) {
    return defaultValue;
  }

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const suffix = defaultValue ? "[Y/n]" : "[y/N]";

  const answer: string = await new Promise((resolve) => {
    rl.question(`${prompt} ${suffix} `, resolve);
  });

  rl.close();

  if (!answer.trim()) {
    return defaultValue;
  }

  const normalized = answer.trim().toLowerCase();
  return normalized === "y" || normalized === "yes";
}

export function heading(title: string): void {
  const line = "-".repeat(title.length + 4);
  // eslint-disable-next-line no-console
  console.log(`\n${line}\n  ${title}\n${line}`);
}

export function info(message: string): void {
  // eslint-disable-next-line no-console
  console.log(`ℹ️  ${message}`);
}

export function success(message: string): void {
  // eslint-disable-next-line no-console
  console.log(`✅ ${message}`);
}

export function warn(message: string): void {
  // eslint-disable-next-line no-console
  console.warn(`⚠️  ${message}`);
}

export function error(message: string): void {
  // eslint-disable-next-line no-console
  console.error(`❌ ${message}`);
}

export function parseFlags(argv: string[]): Record<string, string | boolean> {
  const flags: Record<string, string | boolean> = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token.startsWith("--")) {
      const { key, explicitValue } = extractFlagToken(token);
      if (key) {
        const { value, offset } = resolveFlagValue(explicitValue, argv[index + 1]);
        setFlagValue(flags, key, value);
        index += offset;
      }
    }
  }

  return flags;
}

function extractFlagToken(token: string): { key: string | undefined; explicitValue?: string } {
  const [rawKey, value] = token.slice(2).split("=");
  const key = rawKey.replaceAll(/[^\da-z-]/gi, "");
  return { key: key || undefined, explicitValue: value };
}

function resolveFlagValue(
  explicit: string | undefined,
  nextToken?: string,
): { value: string | boolean; offset: number } {
  if (explicit !== undefined) {
    return { value: explicit, offset: 0 };
  }

  if (nextToken && !nextToken.startsWith("--")) {
    return { value: nextToken, offset: 1 };
  }

  return { value: true, offset: 0 };
}

function setFlagValue(
  target: Record<string, string | boolean>,
  key: string,
  value: string | boolean,
): void {
  Object.assign(
    target,
    // eslint-disable-next-line security/detect-object-injection
    { [key]: value },
  );
}

export function toCamelCase(input: string): string {
  return input
    .replaceAll(/[\s_-]+(.)?/g, (_, chr: string) => (chr ? chr.toUpperCase() : ""))
    .replace(/^(.)/, (match) => match.toLowerCase());
}

export function toPascalCase(input: string): string {
  const camel = toCamelCase(input);
  return camel.charAt(0).toUpperCase() + camel.slice(1);
}

export function toKebabCase(input: string): string {
  return input
    .replaceAll(/([\da-z])([A-Z])/g, "$1-$2")
    .replaceAll(/[\s_]+/g, "-")
    .toLowerCase();
}
