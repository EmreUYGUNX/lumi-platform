import { describe, expect, it } from "@jest/globals";

import { renderLayout } from "../layout.js";

const baseContext = {
  locale: "en",
  baseUrl: "https://lumi.test",
  brand: {
    productName: "Lumi Platform",
    supportEmail: "support@lumi.test",
    supportUrl: "https://lumi.test/support",
  },
} as const;

describe("email layout", () => {
  it("omits the preheader block when preview text is absent", () => {
    const { html } = renderLayout({
      subject: "No preview",
      bodyHtml: "<p>Hello</p>",
      bodyText: "Hello",
      context: baseContext,
    });

    expect(html).not.toContain('<span class="preheader">');
  });

  it("builds a support footer that falls back to base URL when support URL is missing", () => {
    const { text } = renderLayout({
      subject: "Support fallback",
      bodyHtml: "<p>Body</p>",
      bodyText: "Body",
      context: {
        ...baseContext,
        brand: {
          ...baseContext.brand,
          supportUrl: undefined,
        },
      },
      previewText: "Preview",
    });

    expect(text).toContain("support@lumi.test");
    expect(text).not.toContain("support centre");
  });
});
