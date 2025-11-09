import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { OpenAPIV3_1 as OpenApi31 } from "openapi-types";
import { parse } from "yaml";

const resolveSpecCandidates = (): string[] => {
  const candidates: string[] = [];
  let importMetaUrl: string | undefined;
  try {
    // eslint-disable-next-line no-new-func -- Required for compatibility with TS transpilation targets.
    importMetaUrl = new Function("return import.meta.url")() as string;
  } catch {
    // Older Node targets may not expose import.meta; silently ignore.
  }

  if (importMetaUrl) {
    candidates.push(
      fileURLToPath(new URL("openapi.yaml", importMetaUrl)),
      fileURLToPath(new URL("../../src/api-schemas/openapi.yaml", importMetaUrl)),
    );
  }

  if (typeof __dirname === "string") {
    candidates.push(
      path.resolve(__dirname, "openapi.yaml"),
      path.resolve(__dirname, "../../src/api-schemas/openapi.yaml"),
    );
  }

  const cwd = process.cwd();
  candidates.push(
    path.resolve(cwd, "packages/shared/src/api-schemas/openapi.yaml"),
    path.resolve(cwd, "packages/shared/dist/api-schemas/openapi.yaml"),
    path.resolve(cwd, "../packages/shared/src/api-schemas/openapi.yaml"),
    path.resolve(cwd, "../packages/shared/dist/api-schemas/openapi.yaml"),
  );

  return candidates;
};

const readSpecFile = (): string => {
  let contents: string | undefined;

  resolveSpecCandidates().some((candidate) => {
    try {
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- Candidate list sourced from known repo paths.
      contents = readFileSync(candidate, "utf8");
      return true;
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") {
        return false;
      }

      throw error;
    }
  });

  if (!contents) {
    throw new Error("OpenAPI specification file not found in @lumi/shared.");
  }

  return contents;
};

let cachedDocument: OpenApi31.Document | undefined;

export const getCoreApiOpenApiDocument = (): OpenApi31.Document => {
  if (!cachedDocument) {
    const raw = readSpecFile();
    cachedDocument = parse(raw) as OpenApi31.Document;
  }

  return structuredClone(cachedDocument);
};
