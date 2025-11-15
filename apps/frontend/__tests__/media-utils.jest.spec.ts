import { describe, expect, it } from "@jest/globals";

import { formatFileSize, normaliseTagInput } from "@/features/media/utils/media-formatters";
import { buildCloudinaryUrl, buildSizesAttribute } from "@/lib/cloudinary";

describe("media utility formatters", () => {
  it("formats bytes into human readable strings", () => {
    expect(formatFileSize(1024)).toBe("1.0 KB");
    expect(formatFileSize(5 * 1024 * 1024)).toBe("5.0 MB");
  });

  it("normalises tag input", () => {
    expect(normaliseTagInput("Product:123, HERO story")).toEqual(["product:123", "hero", "story"]);
  });
});

describe("cloudinary helpers", () => {
  it("builds a url for a public id", () => {
    expect(buildCloudinaryUrl({ publicId: "lumi/products/test", width: 200 })).toContain("w_200");
  });

  it("passes through remote sources", () => {
    const source = "https://res.cloudinary.com/demo/image/upload/sample.jpg";
    expect(buildCloudinaryUrl({ src: source })).toBe(source);
  });

  it("builds sizes attribute presets", () => {
    expect(buildSizesAttribute("thumbnail")).toContain("180px");
  });
});
