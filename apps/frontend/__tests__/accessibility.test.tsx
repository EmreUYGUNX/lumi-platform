import React from "react";

import axe from "axe-core";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import LoginPage from "@/app/(auth)/login/page";
import RegisterPage from "@/app/(auth)/register/page";
import { QueryProvider } from "@/providers/QueryProvider";

const runAxe = async (node: HTMLElement) => {
  // jsdom does not implement canvas; axe checks need a stub
  // eslint-disable-next-line @typescript-eslint/unbound-method
  const originalGetContext = HTMLCanvasElement.prototype.getContext;
  const mockCanvas = document.createElement("canvas");
  const mockImageData: ImageData =
    typeof ImageData === "undefined"
      ? ({
          data: new Uint8ClampedArray(),
          width: 0,
          height: 0,
          colorSpace: "srgb",
        } as ImageData)
      : new ImageData(new Uint8ClampedArray(), 0, 0);
  const mockTextMetrics: TextMetrics = {
    width: 0,
    actualBoundingBoxAscent: 0,
    actualBoundingBoxDescent: 0,
    actualBoundingBoxLeft: 0,
    actualBoundingBoxRight: 0,
    fontBoundingBoxAscent: 0,
    fontBoundingBoxDescent: 0,
    emHeightAscent: 0,
    emHeightDescent: 0,
    hangingBaseline: 0,
    alphabeticBaseline: 0,
    ideographicBaseline: 0,
  };

  const mockContext = {
    fillRect: () => {},
    clearRect: () => {},
    getImageData: () => mockImageData,
    putImageData: () => {},
    createImageData: () => mockImageData,
    setTransform: () => {},
    drawImage: () => {},
    save: () => {},
    fillText: () => {},
    restore: () => {},
    measureText: () => mockTextMetrics,
    transform: () => {},
    rotate: () => {},
    translate: () => {},
    scale: () => {},
    beginPath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    closePath: () => {},
    stroke: () => {},
    arc: () => {},
    fill: () => {},
    canvas: mockCanvas,
  } as unknown as CanvasRenderingContext2D;
  const getContextStub = ((contextId: string) =>
    contextId === "2d"
      ? mockContext
      : undefined) as unknown as typeof HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = getContextStub;

  // axe needs to operate on the document; clone current document to avoid mutating test DOM
  const html = node.outerHTML;
  const container = document.createElement("div");
  container.innerHTML = html;
  document.body.append(container);
  const results = await axe.run(container, {
    // color-contrast needs real rendering; disable for jsdom
    rules: { "color-contrast": { enabled: false } },
  });
  container.remove();
  HTMLCanvasElement.prototype.getContext = originalGetContext;
  return results;
};

const withProviders = (element: React.ReactNode) => <QueryProvider>{element}</QueryProvider>;

describe("Accessibility - axe-core", () => {
  it("login page has no axe violations", async () => {
    const { container } = render(withProviders(<LoginPage />));
    const results = await runAxe(container);
    expect(results.violations).toHaveLength(0);
  });

  it("register page has no axe violations", async () => {
    const { container } = render(withProviders(<RegisterPage />));
    const results = await runAxe(container);
    if (results.violations.length > 0) {
      // surface details in test output for quick remediation
      // eslint-disable-next-line no-console
      console.warn(
        "Register page axe violations",
        JSON.stringify(results.violations, undefined, 2),
      );
    }
    expect(results.violations).toHaveLength(0);
  });
});
