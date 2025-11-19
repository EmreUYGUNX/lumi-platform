import { Children, isValidElement } from "react";

import { describe, it } from "@jest/globals";

import RootLayout, { metadata } from "@/app/layout";

describe("RootLayout component", () => {
  it("declares the public metadata for the application shell", () => {
    expect(metadata.title).toBe("Lumi Commerce Experience");
    expect(metadata.description).toContain("Next.js foundation");
  });

  it("wraps children with the correct HTML structure", () => {
    const layoutElement = RootLayout({ children: <span>Child node</span> });
    expect(layoutElement.type).toBe("html");
    expect(layoutElement.props.lang).toBe("en");

    const bodyElement = layoutElement.props.children;
    expect(isValidElement(bodyElement)).toBe(true);
    expect(bodyElement.type).toBe("body");
    expect(bodyElement.props.className).toContain("bg-lumi-background");

    const themeProvider = bodyElement.props.children;
    expect(isValidElement(themeProvider)).toBe(true);

    const appShell = themeProvider.props.children;
    expect(isValidElement(appShell)).toBe(true);
    expect(appShell.props.className).toContain("flex");

    const renderedChildren = Children.toArray(appShell.props.children);
    const projectedChild = renderedChildren.at(-1);
    expect(isValidElement(projectedChild)).toBe(true);
    if (!isValidElement(projectedChild)) {
      throw new Error("RootLayout failed to project its children");
    }
    expect(projectedChild.props.children).toBe("Child node");
  });
});
