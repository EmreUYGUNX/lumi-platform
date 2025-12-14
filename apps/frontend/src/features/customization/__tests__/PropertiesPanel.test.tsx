import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type * as fabric from "fabric";

import { PropertiesPanel } from "../components/editor/PropertiesPanel";

const createCanvasStub = (object?: Record<string, unknown>) => {
  const canvas = {
    getActiveObject: () => object as unknown as fabric.Object,
    on: vi.fn(),
    off: vi.fn(),
    fire: vi.fn(),
    requestRenderAll: vi.fn(),
    discardActiveObject: vi.fn(),
  };

  return canvas as unknown as fabric.Canvas;
};

describe("PropertiesPanel", () => {
  it("renders an empty state when nothing is selected", () => {
    render(<PropertiesPanel />);
    expect(screen.getByText("Select a layer to edit its properties.")).toBeInTheDocument();
  });

  it("allows renaming the selected layer and adjusts opacity", () => {
    const object: Record<string, unknown> = {
      type: "textbox",
      layerType: "text",
      layerName: "HEADLINE",
      isLocked: false,
      isHidden: false,
      left: 10,
      top: 20,
      angle: 0,
      opacity: 1,
      flipX: false,
      flipY: false,
      fontFamily: "Inter",
      fontSize: 32,
      fontWeight: "600",
      textAlign: "center",
      charSpacing: 0,
      lineHeight: 1.2,
      fill: "#111827",
      strokeWidth: 0,
      stroke: "#111827",
      shadow: undefined,
      backgroundColor: undefined,
      padding: 0,
      getScaledWidth: () => 200,
      getScaledHeight: () => 80,
      set: vi.fn((props: Record<string, unknown>) => {
        Object.assign(object, props);
      }),
      setCoords: vi.fn(),
    };

    const canvas = createCanvasStub(object);

    render(<PropertiesPanel canvas={canvas} />);

    const nameInput = screen.getByLabelText("Layer name") as HTMLInputElement;
    expect(nameInput.value).toBe("HEADLINE");

    fireEvent.change(nameInput, { target: { value: "New title" } });
    fireEvent.blur(nameInput);

    expect(object.layerName).toBe("New title");
    const fireSpy = (canvas as unknown as { fire: ReturnType<typeof vi.fn> }).fire;
    expect(fireSpy).toHaveBeenCalledWith("object:modified", expect.anything());

    const opacitySlider = screen.getByLabelText("Opacity") as HTMLInputElement;
    fireEvent.change(opacitySlider, { target: { value: "55" } });

    expect(object.opacity).toBeCloseTo(0.55);
  });
});
