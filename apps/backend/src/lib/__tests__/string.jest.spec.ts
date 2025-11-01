import { describe, expect, it } from "@jest/globals";

import { deriveSearchKeywords, generateSlug } from "../string.js";

describe("string helpers", () => {
  it("normalises text into URL friendly slugs", () => {
    expect(generateSlug(" Aurora Lamp ")).toBe("aurora-lamp");
    expect(generateSlug("Lumi Commerce 2025!")).toBe("lumi-commerce-2025");
    expect(generateSlug("Türkçe İsim")).toBe("t-rk-e-isim");
  });

  it("builds deduplicated keyword lists from title, summary, and explicit array", () => {
    const keywords = deriveSearchKeywords(
      "Aurora Desk Lamp",
      "Ambient lighting for modern workspaces",
      ["Desk", "lamp", "AURORA"],
    );

    expect(keywords).toContain("aurora");
    expect(keywords).toContain("lighting");
    expect(keywords).toContain("desk");
    expect(keywords).not.toContain("");
    expect(new Set(keywords).size).toBe(keywords.length);
  });
});
