import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

import { stringify } from "yaml";

import type { getConfig as GetConfig } from "@lumi/backend/src/config/index";
import type { createOpenApiDocument as CreateOpenApiDocument } from "@lumi/backend/src/config/swagger";
import type { createTestConfig as CreateTestConfig } from "@lumi/backend/src/testing/config";
import type { ApplicationConfig } from "@lumi/types";

const OUTPUT_PATH = path.resolve(process.cwd(), "docs/api/openapi.yaml");

const ensureDirectory = async (filePath: string) => {
  const directory = path.dirname(filePath);
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- directory is derived from a constant output path.
  await mkdir(directory, { recursive: true });
};

const importBackendModule = async <TModule>(relativePath: string): Promise<TModule> => {
  const absolutePath = path.resolve(process.cwd(), relativePath);
  return (await import(pathToFileURL(absolutePath).href)) as TModule;
};

const loadConfiguration = async (): Promise<ApplicationConfig> => {
  try {
    const { getConfig } = await importBackendModule<{ getConfig: typeof GetConfig }>(
      "apps/backend/src/config/index.ts",
    );
    return getConfig();
  } catch (error) {
    const { createTestConfig } = await importBackendModule<{
      createTestConfig: typeof CreateTestConfig;
    }>("apps/backend/src/testing/config.ts");
    const fallback = createTestConfig({
      app: {
        environment: "development",
      },
    });

    const issues =
      typeof error === "object" &&
      error !== null &&
      Array.isArray((error as { issues?: unknown }).issues)
        ? ((error as { issues: { path: (string | number)[] }[] }).issues ?? []).map((issue) =>
            issue.path.join("."),
          )
        : [];

    const reason =
      issues.length > 0
        ? `missing environment variables: ${issues.join(", ")}`
        : error instanceof Error
          ? error.message
          : String(error);
    // eslint-disable-next-line no-console -- Script feedback.
    console.warn(
      "Falling back to test configuration for OpenAPI generation:",
      reason || "Unknown error",
    );

    return fallback;
  }
};

const buildDocument = async (config: ApplicationConfig) => {
  const { createOpenApiDocument } = await importBackendModule<{
    createOpenApiDocument: typeof CreateOpenApiDocument;
  }>("apps/backend/src/config/swagger.ts");
  return createOpenApiDocument(config);
};

const serializeDocument = (document: unknown) =>
  stringify(document, {
    aliasDuplicateObjects: false,
    lineWidth: 120,
  });

const writeDocument = async (content: string) => {
  await ensureDirectory(OUTPUT_PATH);
  await writeFile(OUTPUT_PATH, `${content.trimEnd()}\n`, { encoding: "utf8" });
};

const verifyDocument = async (content: string) => {
  if (!existsSync(OUTPUT_PATH)) {
    throw new Error(
      "OpenAPI specification not found. Run `pnpm docs:openapi:generate` and commit the result.",
    );
  }

  const existing = await readFile(OUTPUT_PATH, "utf8");
  if (existing.trimEnd() !== content.trimEnd()) {
    throw new Error(
      [
        "OpenAPI specification is out of date.",
        "Run `pnpm docs:openapi:generate` to regenerate the spec.",
      ].join(" "),
    );
  }
};

const main = async () => {
  const {
    values: { check },
  } = parseArgs({
    options: {
      check: {
        type: "boolean",
        default: false,
      },
    },
  });

  const config = await loadConfiguration();
  const document = await buildDocument(config);
  const serialized = serializeDocument(document);

  if (check) {
    await verifyDocument(serialized);
    // eslint-disable-next-line no-console -- Script feedback.
    console.log("OpenAPI specification is up to date.");
    return;
  }

  await writeDocument(serialized);
  // eslint-disable-next-line no-console -- Script feedback.
  console.log(`OpenAPI specification written to ${path.relative(process.cwd(), OUTPUT_PATH)}`);
};

// eslint-disable-next-line unicorn/prefer-top-level-await
main().catch((error) => {
  // eslint-disable-next-line no-console -- Script feedback.
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
