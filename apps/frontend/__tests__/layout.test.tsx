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
    const tooltipChildren = Children.toArray(tooltipElement.props.children);
    const appShell = tooltipChildren.find((child) => isValidElement(child));
    const toaster = tooltipChildren.find((child) => {
      if (!isValidElement(child)) return false;
      const elementType = (child as ReactElement).type;
      return (
        typeof elementType === "function" && (elementType as { name?: string }).name === "Toaster"
      );
    });
    if (!appShell || !toaster || !isValidElement(appShell) || !isValidElement(toaster)) {
      throw new Error("App shell or toaster root is not a valid React element.");
    }
    expect((appShell as ReactElement).props.className).toContain("flex");

    const containsChildNode = (node: unknown): boolean => {
      if (!isValidElement(node)) {
        return false;
      }
      const element = node as ReactElement;
      if (element.props?.children === "Child node") {
        return true;
      }
      const childrenArray = Children.toArray(element.props?.children);
      return childrenArray.some((child) => containsChildNode(child));
    };

    const renderedChildren = Children.toArray((appShell as ReactElement).props.children);
    expect(renderedChildren.some((child) => containsChildNode(child))).toBe(true);
  });
});
