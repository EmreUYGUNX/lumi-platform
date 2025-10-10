import { existsSync } from "node:fs";
import { cp, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { error, heading, info, parseFlags, repoRoot, success, warn } from "./utils";

const { resolve, dirname } = path;

interface BackupItem {
  path: string;
  required?: boolean;
}

const items: BackupItem[] = [
  { path: ".env", required: false },
  { path: ".env.template", required: true },
  { path: "env/.env.docker", required: true },
  { path: "pnpm-lock.yaml", required: true },
  { path: "package.json", required: true },
  { path: "pnpm-workspace.yaml", required: true },
  { path: "turbo.json", required: true },
  { path: "docker-compose.yml", required: true },
  { path: "docker-compose.prod.yml", required: false },
  { path: "tools/config/prune.json", required: true },
];

async function ensureParent(directory: string): Promise<void> {
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  if (!existsSync(directory)) {
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    await mkdir(directory, { recursive: true });
  }
}

async function main(): Promise<void> {
  const flags = parseFlags(process.argv.slice(2));
  const tag = typeof flags.tag === "string" ? flags.tag : undefined;
  const timestamp = new Date().toISOString().replaceAll(/[.:]/g, "-");
  const folderName = tag ? `${timestamp}-${tag}` : timestamp;
  const backupsRoot = resolve(repoRoot, "backups");
  const backupDir = resolve(backupsRoot, folderName);

  heading("Workspace Backup");
  info(`Destination: ${backupDir}`);

  await ensureParent(backupDir);

  const copied: string[] = [];

  await Promise.all(
    items.map(async (item) => {
      const absoluteSource = resolve(repoRoot, item.path);
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      if (!existsSync(absoluteSource)) {
        if (item.required) {
          warn(`Missing required item ${item.path} – skipping but review is recommended.`);
        }
        return;
      }

      const targetPath = resolve(backupDir, item.path);
      await ensureParent(dirname(targetPath));
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      await cp(absoluteSource, targetPath, { recursive: true });
      info(`↪ Copied ${item.path}`);
      copied.push(item.path);
    }),
  );

  const manifest = {
    createdAt: new Date().toISOString(),
    tag: tag ?? undefined,
    items: copied,
    nodeVersion: process.version,
    commit: process.env.GIT_COMMIT_SHA ?? undefined,
  };

  // eslint-disable-next-line security/detect-non-literal-fs-filename
  await writeFile(
    resolve(backupDir, "manifest.json"),
    `${JSON.stringify(manifest, undefined, 2)}\n`,
    "utf8",
  );
  success(`Backup completed. ${copied.length} item(s) captured.`);
  info("To restore, run: pnpm run backup:restore -- --path <folder>");
}

try {
  await main();
} catch (error_) {
  error(`Backup failed: ${(error_ as Error).stack ?? (error_ as Error).message}`);
  process.exitCode = 1;
}
