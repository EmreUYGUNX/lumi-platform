import { describe, expect, it } from "@jest/globals";

import { sanitizeSvg } from "../svg-sanitizer.js";

describe("sanitizeSvg", () => {
  it("strips scripts and event handlers", () => {
    const malicious = `
      <svg xmlns="http://www.w3.org/2000/svg">
        <script>alert("XSS")</script>
        <rect width="100" height="100" onclick="alert('XSS')" />
      </svg>
    `;

    const sanitized = sanitizeSvg(malicious);

    expect(sanitized).not.toContain("<script");
    expect(sanitized).not.toContain("onclick");
    expect(sanitized).toContain("<svg");
    expect(sanitized).toContain("<rect");
  });

  it("removes external href references", () => {
    const malicious = `
      <svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
        <use xlink:href="https://example.com/bad.svg#icon" />
        <use xlink:href="#safe-icon" />
      </svg>
    `;

    const sanitized = sanitizeSvg(malicious);

    expect(sanitized).not.toContain("https://example.com");
    expect(sanitized).toContain("#safe-icon");
  });
});
