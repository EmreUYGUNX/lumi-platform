import { Children, isValidElement } from "react";
import type { ReactElement } from "react";

import { describe, expect, it } from "vitest";

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
    if (!isValidElement(themeProvider)) {
      throw new Error("ThemeProvider failed to mount in RootLayout");
    }
    const themeProviderElement = themeProvider as ReactElement;

    const queryProvider = themeProviderElement.props.children;
    expect(isValidElement(queryProvider)).toBe(true);
    if (!isValidElement(queryProvider)) {
      throw new Error("QueryProvider failed to mount in RootLayout");
    }
    const queryProviderElement = queryProvider as ReactElement;

    const motionConfig = queryProviderElement.props.children;
    expect(isValidElement(motionConfig)).toBe(true);
    if (!isValidElement(motionConfig)) {
      throw new Error("MotionConfig failed to mount in RootLayout");
    }
    const motionConfigElement = motionConfig as ReactElement;

    const tooltipProvider = motionConfigElement.props.children;
    expect(isValidElement(tooltipProvider)).toBe(true);
    if (!isValidElement(tooltipProvider)) {
      throw new Error("TooltipProvider failed to mount in RootLayout");
    }

    const tooltipElement = tooltipProvider as ReactElement;
    const [appShell, toaster] = Children.toArray(tooltipElement.props.children);
    if (!isValidElement(appShell) || !isValidElement(toaster)) {
      throw new Error("App shell or toaster root is not a valid React element.");
    }
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
