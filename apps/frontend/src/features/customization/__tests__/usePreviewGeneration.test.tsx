import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import type * as fabric from "fabric";

import { usePreviewGeneration } from "../hooks/usePreviewGeneration";

vi.mock("@/lib/api-client", () => ({
  apiClient: {
    post: vi.fn(),
  },
}));

const createCanvasStub = () => {
  const object: Record<string, unknown> = {
    type: "textbox",
    layerType: "text",
    layerId: "layer_1",
    isHidden: false,
    visible: true,
    left: 10,
    top: 20,
    angle: 0,
    opacity: 1,
    text: "Hello",
    fontFamily: "Inter",
    fontSize: 32,
    fontWeight: "600",
    charSpacing: 0,
    fill: "#111827",
    getScaledWidth: () => 200,
    getScaledHeight: () => 80,
  };

  const canvas = {
    getObjects: () => [object as unknown as fabric.Object],
  };

  return canvas as unknown as fabric.Canvas;
};

describe("usePreviewGeneration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("debounces preview generation by 1s and cancels previous schedules", async () => {
    vi.useFakeTimers();

    const { apiClient } = await import("@/lib/api-client");
    const post = apiClient.post as unknown as ReturnType<typeof vi.fn>;

    post.mockResolvedValue({
      data: {
        previewId: "product_123:hash",
        previewUrl: "https://example.com/preview.webp",
        productId: "product_123",
        designArea: "front",
        resolution: "draft",
        timestamp: new Date().toISOString(),
        cached: false,
      },
      meta: undefined,
    });

    const canvas = createCanvasStub();

    const { result } = renderHook(() => usePreviewGeneration({ debounceMs: 1000 }));

    act(() => {
      result.current.requestPreview(
        { productId: "product_123", designArea: "front", canvas },
        "draft",
      );
      result.current.requestPreview(
        { productId: "product_123", designArea: "front", canvas },
        "draft",
      );
    });

    expect(post).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(999);
    });

    expect(post).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(1);
      await Promise.resolve();
    });

    expect(post).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });

  it("caches identical preview payloads to avoid duplicate API calls", async () => {
    const { apiClient } = await import("@/lib/api-client");
    const post = apiClient.post as unknown as ReturnType<typeof vi.fn>;

    post.mockResolvedValue({
      data: {
        previewId: "product_123:hash",
        previewUrl: "https://example.com/preview.webp",
        productId: "product_123",
        designArea: "front",
        resolution: "draft",
        timestamp: new Date().toISOString(),
        cached: false,
      },
      meta: undefined,
    });

    const canvas = createCanvasStub();
    const { result } = renderHook(() => usePreviewGeneration());

    await act(async () => {
      await result.current.generatePreview(
        { productId: "product_123", designArea: "front", canvas },
        "draft",
      );
    });

    await act(async () => {
      await result.current.generatePreview(
        { productId: "product_123", designArea: "front", canvas },
        "draft",
      );
    });

    expect(post).toHaveBeenCalledTimes(1);
  });
});
