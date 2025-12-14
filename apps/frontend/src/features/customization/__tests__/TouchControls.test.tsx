import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import type * as fabric from "fabric";

import { TouchControls } from "../components/editor/TouchControls";

interface PointerEventLike {
  pointerId: number;
  pointerType?: string;
  clientX: number;
  clientY: number;
}

const dispatchPointerEvent = (target: EventTarget, type: string, init: PointerEventLike): void => {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.assign(event, init);
  target.dispatchEvent(event);
};

const createCanvasStub = () => {
  const upperCanvasEl = document.createElement("canvas");
  upperCanvasEl.getBoundingClientRect = () =>
    ({
      left: 0,
      top: 0,
      width: 200,
      height: 200,
      right: 200,
      bottom: 200,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }) as DOMRect;
  (upperCanvasEl as unknown as { setPointerCapture?: unknown }).setPointerCapture = vi.fn();

  const requestRenderAll = vi.fn();
  const setViewportTransform = vi.fn();

  const canvas = {
    upperCanvasEl,
    viewportTransform: [1, 0, 0, 1, 0, 0],
    getZoom: () => 1,
    setViewportTransform,
    requestRenderAll,
    getActiveObject: vi.fn(),
  };

  return {
    canvas: canvas as unknown as fabric.Canvas,
    upperCanvasEl,
    requestRenderAll,
    setViewportTransform,
  };
};

describe("TouchControls", () => {
  it("triggers swipe tool callback on horizontal swipe", () => {
    const { canvas, upperCanvasEl } = createCanvasStub();
    const onSwipeTool = vi.fn();

    render(<TouchControls canvas={canvas} onSwipeTool={onSwipeTool} />);

    dispatchPointerEvent(upperCanvasEl, "pointerdown", {
      pointerId: 1,
      pointerType: "touch",
      clientX: 10,
      clientY: 10,
    });
    dispatchPointerEvent(upperCanvasEl, "pointerup", {
      pointerId: 1,
      pointerType: "touch",
      clientX: 120,
      clientY: 14,
    });

    expect(onSwipeTool).toHaveBeenCalledWith("right");
  });

  it("enters text editing mode on double tap", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-01T00:00:00.000Z"));

    const { canvas, upperCanvasEl } = createCanvasStub();
    const enterEditing = vi.fn();
    const selectAll = vi.fn();

    (canvas as unknown as { getActiveObject: () => unknown }).getActiveObject = () => ({
      type: "textbox",
      isEditing: false,
      enterEditing,
      selectAll,
    });

    render(<TouchControls canvas={canvas} />);

    dispatchPointerEvent(upperCanvasEl, "pointerdown", {
      pointerId: 1,
      pointerType: "touch",
      clientX: 20,
      clientY: 20,
    });
    dispatchPointerEvent(upperCanvasEl, "pointerup", {
      pointerId: 1,
      pointerType: "touch",
      clientX: 20,
      clientY: 20,
    });

    vi.advanceTimersByTime(120);

    dispatchPointerEvent(upperCanvasEl, "pointerdown", {
      pointerId: 1,
      pointerType: "touch",
      clientX: 21,
      clientY: 20,
    });
    dispatchPointerEvent(upperCanvasEl, "pointerup", {
      pointerId: 1,
      pointerType: "touch",
      clientX: 21,
      clientY: 20,
    });

    expect(enterEditing).toHaveBeenCalledTimes(1);
    expect(selectAll).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });
});
