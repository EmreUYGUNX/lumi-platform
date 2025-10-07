#!/usr/bin/env node

/**
 * Deterministic environment encryption helper.
 * Usage:
 *   pnpm env:seal encrypt <input> <output> [--key=<key>]
 *   pnpm env:seal decrypt <input> <output> [--key=<key>]
 *
 * The command prefers CONFIG_ENCRYPTION_KEY from the environment.
 * Keys may be provided as plain UTF-8, base64 (prefix `base64:`), or hex (prefix `hex:`).
 */
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const USAGE = `Usage:
  pnpm env:seal encrypt <input> <output> [--key=<key>]
  pnpm env:seal decrypt <input> <output> [--key=<key>]`;

const args = process.argv.slice(2);

if (args.length < 3) {
  console.error(USAGE);
  process.exit(1);
}

const mode = args[0];
const inputPath = resolve(args[1]);
const outputPath = resolve(args[2]);

function extractKey() {
  const flag = args.find((arg) => arg.startsWith("--key="));
  const raw = flag ? flag.slice("--key=".length) : process.env.CONFIG_ENCRYPTION_KEY;

  if (!raw) {
    console.error("Missing encryption key. Provide --key=<value> or set CONFIG_ENCRYPTION_KEY.");
    process.exit(1);
  }

  if (raw.startsWith("base64:")) {
    return Buffer.from(raw.slice("base64:".length), "base64");
  }

  if (raw.startsWith("hex:")) {
    return Buffer.from(raw.slice("hex:".length), "hex");
  }

  return Buffer.from(raw, "utf8");
}

const key = extractKey();

if (![32].includes(key.length)) {
  console.error(`CONFIG_ENCRYPTION_KEY must resolve to 32 bytes (received ${key.length}).`);
  process.exit(1);
}

if (!existsSync(inputPath)) {
  console.error(`Input file not found: ${inputPath}`);
  process.exit(1);
}

const ensureDirectory = (filePath) => {
  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
};

const writeSecureFile = (filePath, data) => {
  ensureDirectory(filePath);
  writeFileSync(filePath, data, { mode: 0o600 });
};

function encrypt() {
  const plaintext = readFileSync(inputPath, "utf8");
  const iv = randomBytes(12);

  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  const payload = Buffer.concat([iv, authTag, ciphertext]).toString("base64");
  writeSecureFile(outputPath, payload);
  console.info(`Encrypted ${inputPath} -> ${outputPath}`);
}

function decrypt() {
  const payload = readFileSync(inputPath, "utf8").trim();
  const buffer = Buffer.from(payload, "base64");

  const iv = buffer.subarray(0, 12);
  const authTag = buffer.subarray(12, 28);
  const ciphertext = buffer.subarray(28);

  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);

  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
  writeSecureFile(outputPath, plaintext);
  console.info(`Decrypted ${inputPath} -> ${outputPath}`);
}

if (mode === "encrypt") {
  encrypt();
} else if (mode === "decrypt") {
  decrypt();
} else {
  console.error(`Unsupported mode "${mode}".\n${USAGE}`);
  process.exit(1);
}
