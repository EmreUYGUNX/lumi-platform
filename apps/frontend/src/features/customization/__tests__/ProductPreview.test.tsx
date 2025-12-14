import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import type * as fabric from "fabric";

import { ProductPreview, type ProductPreviewProps } from "../components/editor/ProductPreview";

const createCanvasStub = () => {
  const handlers = new Map<string, () => void>();

  const canvas = {
    on: vi.fn((eventName: string, handler: () => void) => {
      handlers.set(eventName, handler);
    }),
    off: vi.fn(),
  };

  return {
    canvas: canvas as unknown as fabric.Canvas,
    handlers,
  };
};

describe("ProductPreview", () => {
  it("subscribes to Fabric events and throttles preview requests", () => {
    vi.useFakeTimers();

    const { canvas, handlers } = createCanvasStub();
    const requestPreviewMock = vi.fn();
    const cancelPendingMock = vi.fn();

    const previewControls: ProductPreviewProps["previewControls"] = {
      previewUrl: undefined,
      isGenerating: false,
      error: undefined,
      requestPreview:
        requestPreviewMock as unknown as ProductPreviewProps["previewControls"]["requestPreview"],
      generatePreview:
        vi.fn() as unknown as ProductPreviewProps["previewControls"]["generatePreview"],
      retry: vi.fn() as unknown as ProductPreviewProps["previewControls"]["retry"],
      cancelPending:
        cancelPendingMock as unknown as ProductPreviewProps["previewControls"]["cancelPending"],
    };

    render(
      <ProductPreview
        productId="product_123"
        productImageUrl="https://example.com/base.png"
        designArea="front"
        canvas={canvas}
        previewControls={previewControls}
      />,
    );

    expect(handlers.has("object:added")).toBe(true);
    expect(handlers.has("object:removed")).toBe(true);
    expect(handlers.has("object:modified")).toBe(true);
    expect(handlers.has("object:moving")).toBe(true);
    expect(handlers.has("object:scaling")).toBe(true);
    expect(handlers.has("object:rotating")).toBe(true);

    requestPreviewMock.mockClear();

    const moving = handlers.get("object:moving");
    expect(moving).toBeTypeOf("function");

    act(() => {
      moving?.();
      moving?.();
      moving?.();
    });

    expect(requestPreviewMock).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(requestPreviewMock).toHaveBeenCalledTimes(2);

    vi.useRealTimers();
  });

  it("renders area toggle buttons when multiple design areas are provided", () => {
    const { canvas } = createCanvasStub();

    const previewControls: ProductPreviewProps["previewControls"] = {
      previewUrl: undefined,
      isGenerating: false,
      error: undefined,
      requestPreview:
        vi.fn() as unknown as ProductPreviewProps["previewControls"]["requestPreview"],
      generatePreview:
        vi.fn() as unknown as ProductPreviewProps["previewControls"]["generatePreview"],
      retry: vi.fn() as unknown as ProductPreviewProps["previewControls"]["retry"],
      cancelPending: vi.fn() as unknown as ProductPreviewProps["previewControls"]["cancelPending"],
    };

    render(
      <ProductPreview
        productId="product_123"
        productImageUrl="https://example.com/base.png"
        designArea="front"
        canvas={canvas}
        designAreas={[
          { value: "front", label: "Front" },
          { value: "back", label: "Back" },
        ]}
        previewControls={previewControls}
      />,
    );

    expect(screen.getByRole("button", { name: "Front" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Back" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Back" }));
  });
});
