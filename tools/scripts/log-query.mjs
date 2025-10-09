#!/usr/bin/env node

/**
 * Lightweight CLI for querying structured Lumi logs produced by Winston.
 *
 * Usage:
 *   pnpm exec node tools/scripts/log-query.mjs --level error --request req-123
 */

import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";

const parseArgs = (argv) => {
  const options = {
    dir: "logs",
    file: undefined,
    level: undefined,
    request: undefined,
    contains: undefined,
    limit: Infinity,
    json: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--dir" && argv[index + 1]) {
      options.dir = argv[index + 1];
      index += 1;
    } else if (token === "--file" && argv[index + 1]) {
      options.file = argv[index + 1];
      index += 1;
    } else if (token === "--level" && argv[index + 1]) {
      options.level = argv[index + 1].toLowerCase();
      index += 1;
    } else if (token === "--request" && argv[index + 1]) {
      options.request = argv[index + 1];
      index += 1;
    } else if (token === "--contains" && argv[index + 1]) {
      options.contains = argv[index + 1];
      index += 1;
    } else if (token === "--limit" && argv[index + 1]) {
      const parsed = Number.parseInt(argv[index + 1], 10);
      if (!Number.isNaN(parsed) && parsed > 0) {
        options.limit = parsed;
      }
      index += 1;
    } else if (token === "--json") {
      options.json = true;
    } else if (token === "--help") {
      options.help = true;
    }
  }

  return options;
};

const printHelp = () => {
  process.stdout.write(
    `Lumi Log Query Utility
Usage:
  node tools/scripts/log-query.mjs [options]

Options:
  --dir <path>        Directory containing log files (default: logs)
  --file <path>       Specific log file to read (overrides --dir)
  --level <level>     Filter by log level (trace, debug, info, warn, error, fatal)
  --request <id>      Filter by requestId context value
  --contains <text>   Match message substring (case-insensitive)
  --limit <number>    Limit results (default: unlimited)
  --json              Output raw JSON instead of formatted text
  --help              Show this help message
`,
  );
};

const loadCandidateFiles = async (options) => {
  if (options.file) {
    return [options.file];
  }

  const directory = path.resolve(options.dir);
  if (!fs.existsSync(directory)) {
    return [];
  }

  const entries = await fs.promises.readdir(directory);
  return entries
    .filter((entry) => entry.endsWith(".log"))
    .sort()
    .map((entry) => path.join(directory, entry));
};

const matchesFilters = (record, options) => {
  if (options.level && record.level !== options.level) {
    return false;
  }

  if (options.request) {
    const contextRequest = record.requestId || record.context?.requestId;
    if (contextRequest !== options.request) {
      return false;
    }
  }

  if (options.contains) {
    const haystack = `${record.message ?? ""}`.toLowerCase();
    if (!haystack.includes(options.contains.toLowerCase())) {
      return false;
    }
  }

  return true;
};

const formatRecord = (record, file) => {
  const timestamp = record.timestamp ?? "";
  const level = record.level?.toUpperCase() ?? "INFO";
  const request = record.requestId ? ` req=${record.requestId}` : "";
  const context =
    record.context && Object.keys(record.context).length > 0
      ? ` context=${JSON.stringify(record.context)}`
      : "";
  const extra =
    record.error || record.details
      ? ` details=${JSON.stringify({
          error: record.error,
          details: record.details,
        })}`
      : "";

  return `[${timestamp}] ${level} ${record.message ?? ""}${request}${context}${extra} (${path.basename(
    file,
  )})`;
};

const run = async () => {
  const options = parseArgs(process.argv.slice(2));

  if (options.help) {
    printHelp();
    process.exit(0);
  }

  const files = await loadCandidateFiles(options);

  if (files.length === 0) {
    process.stderr.write("No log files found.\n");
    process.exit(1);
  }

  let processed = 0;

  for (const file of files) {
    if (processed >= options.limit) {
      break;
    }

    const stream = fs.createReadStream(file, { encoding: "utf8" });
    const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

    // eslint-disable-next-line no-await-in-loop
    for await (const line of rl) {
      if (processed >= options.limit) {
        break;
      }

      if (!line.trim()) {
        continue;
      }

      let record;
      try {
        record = JSON.parse(line);
      } catch (error) {
        continue;
      }

      if (!matchesFilters(record, options)) {
        continue;
      }

      if (options.json) {
        process.stdout.write(`${JSON.stringify(record)}\n`);
      } else {
        process.stdout.write(`${formatRecord(record, file)}\n`);
      }

      processed += 1;
      if (processed >= options.limit) {
        break;
      }
    }
  }
};

run().catch((error) => {
  process.stderr.write(`Log query failed: ${error.message}\n`);
  process.exit(1);
});
