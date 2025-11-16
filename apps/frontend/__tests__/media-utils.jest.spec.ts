import { describe, expect, it } from "@jest/globals";

import { formatFileSize, normaliseTagInput } from "@/features/media/utils/media-formatters";
import { buildCloudinaryUrl, buildSizesAttribute, buildSrcSet } from "@/lib/cloudinary";

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
    const url = buildCloudinaryUrl({ publicId: "lumi/products/test", width: 200 });
    expect(url).toContain("w_200");
    expect(url).toContain("f_auto");
    expect(url).toContain("q_auto:good");
  });

  it("passes through remote sources", () => {
    const source = "https://res.cloudinary.com/demo/image/upload/sample.jpg";
    expect(buildCloudinaryUrl({ src: source })).toBe(source);
  });

  it("builds sizes attribute presets", () => {
    expect(buildSizesAttribute("thumbnail")).toContain("180px");
  });

  it("builds responsive sizes when width is provided", () => {
    const sizes = buildSizesAttribute(undefined, undefined, 1200);
    expect(sizes).toContain("1200px");
    expect(sizes).toContain("(max-width: 320px)");
  });

  it("builds srcset descriptors for multiple widths", () => {
    const srcSet = buildSrcSet({
      publicId: "lumi/products/example",
      widths: [320, 640],
    });
    expect(srcSet).toContain("320w");
    expect(srcSet).toContain("640w");
  });
});
