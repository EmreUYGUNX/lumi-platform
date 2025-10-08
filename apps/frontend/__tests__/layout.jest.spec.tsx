import { Children, isValidElement } from "react";

import { describe, it } from "@jest/globals";

import RootLayout, { metadata } from "@/app/layout";

describe("RootLayout component", () => {
  it("declares the public metadata for the application shell", () => {
    expect(metadata.title).toBe("Lumi Frontend");
    expect(metadata.description).toContain("Placeholder interface");
  });

  it("wraps children with the correct HTML structure", () => {
    const layoutElement = RootLayout({ children: <span>Child node</span> });
    expect(layoutElement.type).toBe("html");
    expect(layoutElement.props.lang).toBe("en");

    const bodyElement = layoutElement.props.children;
    expect(isValidElement(bodyElement)).toBe(true);
    expect(bodyElement.type).toBe("body");

    const child = Children.only(bodyElement.props.children);
    expect(isValidElement(child)).toBe(true);
    expect(child.props.children).toBe("Child node");
  });
});
