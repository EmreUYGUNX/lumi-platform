import { Children, isValidElement } from "react";
import type { ReactElement } from "react";

import { describe, expect, it } from "vitest";

import RootLayout, { metadata } from "@/app/layout";

const assertElement = (node: unknown, label: string): ReactElement => {
  expect(isValidElement(node)).toBe(true);
  if (!isValidElement(node)) {
    throw new Error(`${label} is not a valid React element`);
  }
  return node as ReactElement;
};

const findElementByName = (nodes: unknown[], name: string): ReactElement => {
  const target = nodes.find((child) => {
    if (!isValidElement(child)) return false;
    const elementType = (child as ReactElement).type;
    return typeof elementType === "function" && elementType.name === name;
  });
  return assertElement(target, name);
};

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

    const bodyChildren = Children.toArray(bodyElement.props.children);
    const themeProviderElement = findElementByName(bodyChildren, "ThemeProvider");
    const queryProviderElement = assertElement(
      themeProviderElement.props.children,
      "QueryProvider",
    );
    const motionConfigElement = assertElement(queryProviderElement.props.children, "MotionConfig");
    const tooltipElement = assertElement(motionConfigElement.props.children, "TooltipProvider");
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
