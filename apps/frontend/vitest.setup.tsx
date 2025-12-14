/* eslint-disable import/no-extraneous-dependencies */
import React from "react";

import { cleanup } from "@testing-library/react";
import * as matchers from "@testing-library/jest-dom/matchers";
import "@testing-library/jest-dom/vitest";
import { afterEach, expect, vi } from "vitest";

expect.extend(matchers);

afterEach(() => {
  cleanup();
});

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation(() => ({
    matches: false,
    media: "",
    onchange: undefined,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

if (!Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = () => false;
}
if (!Element.prototype.releasePointerCapture) {
  Element.prototype.releasePointerCapture = () => {};
}
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

class ResizeObserverMock {
  observe = vi.fn();

  unobserve = vi.fn();

  disconnect = vi.fn();
}

if (!("ResizeObserver" in window)) {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore - jsdom environment polyfill
  window.ResizeObserver = ResizeObserverMock;
}

vi.mock("next/image", () => ({
  __esModule: true,
  default: ({ alt, src, ...rest }: { alt?: string; src: string }) => {
    const { loader, priority, blurDataURL, fill, ...imgProps } = rest as Record<string, unknown>;
    // eslint-disable-next-line @next/next/no-img-element -- test environment mock
    return <img alt={alt ?? "image"} src={typeof src === "string" ? src : ""} {...imgProps} />;
  },
}));

vi.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("next/font/google", () => ({
  __esModule: true,
  Inter: () => ({ className: "font-inter", variable: "font-inter" }),
}));

const redirectMock = (url: string) => {
  const error = new Error(`REDIRECT:${url}`);
  // Align with Next.js redirect contract for server components.
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  error.digest = "NEXT_REDIRECT";
  throw error;
};

vi.mock("next/navigation", () => {
  return {
    __esModule: true,
    redirect: redirectMock,
    useRouter: () => ({
      push: vi.fn(),
      replace: vi.fn(),
      prefetch: vi.fn(),
    }),
    usePathname: () => "/dashboard",
    useSearchParams: () => new URLSearchParams(),
  };
});

vi.mock("gsap", () => import("./__mocks__/gsap"));
