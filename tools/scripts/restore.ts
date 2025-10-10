import { existsSync } from "node:fs";
import { cp, readFile, readdir } from "node:fs/promises";
import path from "node:path";

import { confirm, error, heading, info, parseFlags, repoRoot, success, warn } from "./utils";

const { resolve } = path;

interface Manifest {
  createdAt: string;
  tag?: string;
  items: string[];
}

async function selectLatestBackup(backupsRoot: string): Promise<string | undefined> {
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  if (!existsSync(backupsRoot)) {
    return undefined;
  }
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  const entries = await readdir(backupsRoot, { withFileTypes: true });
  const folders = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
  if (folders.length === 0) return undefined;
  folders.sort((a, b) => (a < b ? 1 : -1));
  return resolve(backupsRoot, folders[0]);
}

async function loadManifest(directory: string): Promise<Manifest> {
  const manifestPath = resolve(directory, "manifest.json");
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  if (!existsSync(manifestPath)) {
    throw new Error(`Manifest not found at ${manifestPath}`);
  }
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  const raw = await readFile(manifestPath, "utf8");
  return JSON.parse(raw) as Manifest;
}

async function restore(): Promise<void> {
  const flags = parseFlags(process.argv.slice(2));
  const backupsRoot = resolve(repoRoot, "backups");
  let backupPath: string | undefined;

  if (typeof flags.path === "string") {
    backupPath = resolve(backupsRoot, flags.path);
  } else if (flags.latest) {
    backupPath = await selectLatestBackup(backupsRoot);
  }

  if (!backupPath) {
    throw new Error("No backup path provided. Use --path <dir> or --latest.");
  }

  const selectedBackup = backupPath;

  // eslint-disable-next-line security/detect-non-literal-fs-filename
  if (!existsSync(selectedBackup)) {
    throw new Error(`Backup directory not found: ${selectedBackup}`);
  }

  const manifest = await loadManifest(selectedBackup);
  heading("Workspace Restore");
  info(`Source: ${selectedBackup}`);
  const tagSuffix = manifest.tag ? ` (${manifest.tag})` : "";
  info(`Backup created: ${manifest.createdAt}${tagSuffix}`);

  const dryRun = Boolean(flags["dry-run"]);
  const autoApprove = Boolean(flags.yes) || Boolean(flags.y);

  info("Files to restore:");
  manifest.items.forEach((item) => info(` • ${item}`));

  if (dryRun) {
    warn("Dry run enabled – no files will be written.");
  } else {
    const proceed =
      autoApprove || (await confirm("Restore will overwrite existing files. Continue?", false));
    if (!proceed) {
      warn("Restore aborted by user.");
      return;
    }
  }

  if (dryRun) {
    success("Dry run completed. No files modified.");
    return;
  }

  const missing: string[] = [];

  await Promise.all(
    manifest.items.map(async (item) => {
      const source = resolve(selectedBackup, item);
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      if (!existsSync(source)) {
        missing.push(item);
        return;
      }
      const destination = resolve(repoRoot, item);
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      await cp(source, destination, { recursive: true });
    }),
  );

  missing.forEach((item) => warn(`Missing source in backup: ${item}`));
  success("Restore completed successfully.");
}

try {
  await restore();
} catch (error_) {
  error(`Restore failed: ${(error_ as Error).stack ?? (error_ as Error).message}`);
  process.exitCode = 1;
}
