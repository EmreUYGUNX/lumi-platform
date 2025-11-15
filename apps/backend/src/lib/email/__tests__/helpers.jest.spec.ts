import { describe, expect, it } from "@jest/globals";

import {
  canonicalizeQuery,
  combineTextSections,
  createGreeting,
  escapeHtml,
  formatDateTime,
  renderCtaButton,
  renderDetailsSection,
  renderLink,
} from "../helpers.js";

describe("email helpers", () => {
  it("escapes HTML entities consistently", () => {
    expect(escapeHtml(`<script>alert("&")</script>`)).toBe(
      "&lt;script&gt;alert(&quot;&amp;&quot;)&lt;/script&gt;",
    );
  });

  it("renders safe anchor tags", () => {
    const rendered = renderLink("https://example.com/?q=lamp&lang=en", `"Aurora"`);
    expect(rendered).toContain('href="https://example.com/?q=lamp&amp;lang=en"');
    expect(rendered).toContain("&quot;Aurora&quot;");
  });

  it("formats timestamps using the requested locale", () => {
    const result = formatDateTime(new Date("2024-01-01T12:34:56.000Z"), "en-US");
    expect(result).toBe("January 1, 2024 at 12:34 PM UTC");
  });

  it("renders detail tables and text fallbacks", () => {
    const details = [
      { label: "Order", value: "#1234" },
      { label: "Total", value: "$150.00" },
    ];
    const { html, text } = renderDetailsSection(details);
    expect(html).toContain("<table");
    expect(text).toContain("Order: #1234");

    const empty = renderDetailsSection([]);
    expect(empty.html).toBe("");
    expect(empty.text).toBe("");
  });

  it("renders CTA buttons with matching text fallbacks", () => {
    const cta = renderCtaButton("View Order", "https://example.com/orders/1234");
    expect(cta.html).toContain('class="cta-button"');
    expect(cta.text).toBe("View Order: https://example.com/orders/1234");
  });

  it("builds greetings from optional first names", () => {
    const personalised = createGreeting("  Lumi  ", "Lumi Commerce");
    expect(personalised.text).toBe("Hi Lumi,");

    const fallback = createGreeting("", "Lumi Commerce");
    expect(fallback.text).toBe("Hello from Lumi Commerce,");
  });

  it("combines text sections and drops empty fragments", () => {
    const combined = combineTextSections(["First paragraph", undefined, "  ", "Second"]);
    expect(combined).toBe("First paragraph\n\nSecond");
  });

  it("canonicalises query parameters deterministically", () => {
    const url = new URL("https://example.com/path?b=2&a=1&a=3");
    const canonical = canonicalizeQuery(url);
    expect(canonical).toBe("a=1&a=3&b=2");
  });
});
