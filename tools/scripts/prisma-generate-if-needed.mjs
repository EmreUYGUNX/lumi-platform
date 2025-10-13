#!/usr/bin/env node

import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
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

const stubFiles = [
  {
    name: "index.js",
    content: `'use strict';\nclass PrismaClient {\n  constructor() {\n    console.warn('Prisma client stub active: no models defined in schema.');\n  }\n  async $connect() {}\n  async $disconnect() {}\n  $on(_event, handler) {\n    if (typeof handler === 'function') {\n      handler({});\n    }\n  }\n  $use() {}\n  async $transaction(cb, ...args) {\n    if (typeof cb === 'function') {\n      return cb(this, ...args);\n    }\n    return Promise.resolve(undefined);\n  }\n}\nconst Prisma = {\n  prismaVersion: { client: 'stub', engine: 'stub' },\n  PrismaPromise: Promise\n};\nmodule.exports = { PrismaClient, Prisma, default: { Prisma } };\n`,
  },
  {
    name: "default.js",
    content: `'use strict';\nclass PrismaClient {\n  constructor() {\n    console.warn('Prisma client stub active: no models defined in schema.');\n  }\n  async $connect() {}\n  async $disconnect() {}\n  $on(_event, handler) {\n    if (typeof handler === 'function') {\n      handler({});\n    }\n  }\n  $use() {}\n  async $transaction(cb, ...args) {\n    if (typeof cb === 'function') {\n      return cb(this, ...args);\n    }\n    return Promise.resolve(undefined);\n  }\n}\nconst Prisma = {\n  prismaVersion: { client: 'stub', engine: 'stub' },\n  PrismaPromise: Promise\n};\nmodule.exports = { PrismaClient, Prisma, default: { Prisma } };\n`,
  },
  {
    name: "index.d.ts",
    content: `export interface PrismaClientLogEvent {\n  target?: string;\n  message?: string;\n}\nexport interface PrismaClientQueryEvent extends PrismaClientLogEvent {\n  duration?: number;\n  query?: string;\n  params?: string;\n}\nexport declare class PrismaClient {\n  constructor(options?: Record<string, unknown>);\n  $connect(): Promise<void>;\n  $disconnect(): Promise<void>;\n  $on(event: string, handler: (payload: PrismaClientQueryEvent | PrismaClientLogEvent | Record<string, unknown>) => void): void;\n  $use(middleware: (...args: unknown[]) => void): void;\n  $transaction<T>(fn: (client: PrismaClient, ...args: unknown[]) => Promise<T> | T, options?: Record<string, unknown>): Promise<T>;\n}\nexport declare namespace Prisma {\n  type PrismaPromise<T> = Promise<T>;\n  const prismaVersion: { client: string; engine: string };\n}\nexport default PrismaClient;\n`,
  },
  {
    name: "default.d.ts",
    content: `export interface PrismaClientLogEvent {\n  target?: string;\n  message?: string;\n}\nexport interface PrismaClientQueryEvent extends PrismaClientLogEvent {\n  duration?: number;\n  query?: string;\n  params?: string;\n}\nexport declare class PrismaClient {\n  constructor(options?: Record<string, unknown>);\n  $connect(): Promise<void>;\n  $disconnect(): Promise<void>;\n  $on(event: string, handler: (payload: PrismaClientQueryEvent | PrismaClientLogEvent | Record<string, unknown>) => void): void;\n  $use(middleware: (...args: unknown[]) => void): void;\n  $transaction<T>(fn: (client: PrismaClient, ...args: unknown[]) => Promise<T> | T, options?: Record<string, unknown>): Promise<T>;\n}\nexport declare namespace Prisma {\n  type PrismaPromise<T> = Promise<T>;\n  const prismaVersion: { client: string; engine: string };\n}\nexport default PrismaClient;\n`,
  },
];

const writeStubClient = async () => {
  const clientDir = path.join(repoRoot, "node_modules", ".prisma", "client");
  await mkdir(clientDir, { recursive: true });

  await Promise.all(
    stubFiles.map(({ name, content }) =>
      writeFile(path.join(clientDir, name), content, { encoding: "utf8" }),
    ),
  );
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
    await writeStubClient();
    return;
  }

  loadEnvironment();

  await runPrismaGenerate();
};

main().catch((error) => {
  console.error("Failed to run conditional Prisma generate.", error);
  process.exitCode = 1;
});
