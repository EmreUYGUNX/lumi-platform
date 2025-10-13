#!/usr/bin/env node

import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { config as loadEnvFile } from "dotenv";
import { expand } from "dotenv-expand";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..");

const schemaPath = path.join(repoRoot, "prisma", "schema.prisma");
const envTemplatePath = path.join(repoRoot, "env", ".env.template");
const backendDir = path.join(repoRoot, "apps", "backend");

const hasSchemaDefinitions = async () => {
  try {
    const schema = await readFile(schemaPath, "utf8");
    return /\b(model|view|enum)\s+\w+/i.test(schema);
  } catch (error) {
    console.warn("Unable to read Prisma schema definition.", error);
    return false;
  }
};

const loadEnvironment = () => {
  const result = loadEnvFile({
    path: envTemplatePath,
    override: false,
  });

  expand(result);
};

const runPrismaGenerate = async () =>
  new Promise((resolve, reject) => {
    const child = spawn("pnpm", ["exec", "prisma", "generate"], {
      cwd: backendDir,
      stdio: "inherit",
      env: process.env,
    });

    child.on("exit", (code) => {
      if (code === 0) {
        resolve(undefined);
      } else {
        reject(new Error(`Prisma generate exited with code ${code ?? "unknown"}`));
      }
    });

    child.on("error", (error) => {
      reject(error);
    });
  });

const main = async () => {
  const shouldGenerate = await hasSchemaDefinitions();

  if (!shouldGenerate) {
    console.log("Skipping Prisma generate: no models, views, or enums defined in schema.");
    return;
  }

  loadEnvironment();

  await runPrismaGenerate();
};

main().catch((error) => {
  console.error("Failed to run conditional Prisma generate.", error);
  process.exitCode = 1;
});
