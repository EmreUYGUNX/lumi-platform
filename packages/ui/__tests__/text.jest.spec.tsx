import { describe, it } from "@jest/globals";
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";

import { Text } from "../src/index.js";

describe("Text component", () => {
  it("renders children using the requested element", () => {
    render(<Text as="strong">Hello Lumi</Text>);
    const element = screen.getByText(/Lumi/);
    expect(element.tagName.toLowerCase()).toBe("strong");
    expect(element).toHaveAttribute("data-variant", "custom");
  });

  it("falls back to a span with default variant metadata", () => {
    render(<Text>Hello Default</Text>);
    const element = screen.getByText(/Default/);
    expect(element.tagName.toLowerCase()).toBe("span");
    expect(element).toHaveAttribute("data-variant", "body");
  });
});
