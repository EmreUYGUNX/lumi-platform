#!/usr/bin/env node

import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const frontendDir = resolve(__dirname, "../../apps/frontend");
const command = process.platform === "win32" ? "pnpm.cmd" : "pnpm";

const child = spawn(command, ["--dir", frontendDir, "run", "build"], {
  stdio: "inherit",
  env: {
    ...process.env,
    ANALYZE: "true",
    NODE_ENV: process.env.NODE_ENV ?? "production"
  }
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
