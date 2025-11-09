import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, jest } from "@jest/globals";

const SPEC_FIXTURE = `openapi: 3.1.0
info:
  title: Fixture Spec
  version: 1.0.0
paths: {}
`;

const createTempSpec = (): string => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lumi-openapi-"));
  const filePath = path.join(dir, "spec.yaml");
  fs.writeFileSync(filePath, SPEC_FIXTURE, "utf8");
  return filePath;
};

const cleanupTempSpec = (filePath: string | undefined) => {
  if (!filePath) {
    return;
  }
  try {
    fs.rmSync(path.dirname(filePath), { recursive: true, force: true });
  } catch {
    // Best-effort cleanup; ignore failures so tests remain resilient on CI.
  }
};

describe("getCoreApiOpenApiDocument", () => {
  let tempSpecPath: string | undefined;

  afterEach(() => {
    delete process.env.LUMI_OPENAPI_SPEC_PATH;
    cleanupTempSpec(tempSpecPath);
    tempSpecPath = undefined;
    jest.resetModules();
    jest.restoreAllMocks();
  });

  it("loads the override spec once and returns cloned documents", async () => {
    tempSpecPath = createTempSpec();
    process.env.LUMI_OPENAPI_SPEC_PATH = tempSpecPath;
    const readSpy = jest.spyOn(fs, "readFileSync");

    const { getCoreApiOpenApiDocument } = await import("../src/api-schemas/index.js");

    const first = getCoreApiOpenApiDocument();
    first.info = { ...first.info, title: "Mutated" };

    const second = getCoreApiOpenApiDocument();

    expect(second.info?.title).toBe("Fixture Spec");
    expect(first).not.toBe(second);
    const readsForOverride = readSpy.mock.calls.filter(([filename]) => filename === tempSpecPath);
    expect(readsForOverride).toHaveLength(1);
  });

  it("throws a descriptive error when no candidates can be read", async () => {
    const enoent = Object.assign(new Error("missing"), { code: "ENOENT" });
    jest.spyOn(fs, "readFileSync").mockImplementation(() => {
      throw enoent;
    });

    const { getCoreApiOpenApiDocument } = await import("../src/api-schemas/index.js");

    expect(() => getCoreApiOpenApiDocument()).toThrow(
      "OpenAPI specification file not found in @lumi/shared.",
    );
  });
});
