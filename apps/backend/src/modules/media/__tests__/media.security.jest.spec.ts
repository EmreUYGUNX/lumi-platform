import { describe, expect, it } from "@jest/globals";

import { ApiError } from "@/errors/api-error.js";

import { MediaScanService, sanitizeFilename } from "../media.security.js";

const EICAR_CONTENT = Buffer.from(
  "X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*",
  "ascii",
);

describe("media.security", () => {
  it("sanitizes filenames and preserves extensions", () => {
    const sanitised = sanitizeFilename(" Prøduct IMG (Final).PNG ", "png");
    expect(sanitised).toBe("pr-duct-img-final-png.png");

    const withoutExtension = sanitizeFilename("unsafe\\\\name");
    expect(withoutExtension).toBe("unsafe-name");
  });

  it("generates deterministic safe names when no seed provided", () => {
    const deterministic = MediaScanService.generateDeterministicName(" Hero Banner ");
    expect(deterministic).toBe("hero-banner");

    const fallback = MediaScanService.generateDeterministicName("");
    expect(fallback).toMatch(/^media-asset-/u);
  });

  it("detects malware signatures when scanning buffers", async () => {
    const service = new MediaScanService({ enabled: true });
    await expect(
      service.scan({
        buffer: EICAR_CONTENT,
        filename: "dangerous.txt",
      }),
    ).rejects.toBeInstanceOf(ApiError);
  });

  it("allows clean buffers to pass through when scanning disabled", async () => {
    const service = new MediaScanService({ enabled: false });
    await expect(
      service.scan({
        buffer: Buffer.from("safe-file"),
        filename: "safe.txt",
      }),
    ).resolves.toBeUndefined();
  });
});
