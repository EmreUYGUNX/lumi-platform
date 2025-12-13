import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import type { Layer } from "../types/layer.types";
import { LayerPanel } from "../components/editor/LayerPanel";

const buildBaseLayer = (overrides: Partial<Layer> = {}): Layer =>
  ({
    layerId: "layer_1",
    layerType: "text",
    layerName: "HEADLINE",
    isLocked: false,
    isHidden: false,
    zIndex: 0,
    position: { x: 0, y: 0, width: 100, height: 40, rotation: 0 },
    fabricObject: { type: "textbox" },
    text: "Hello",
    fontFamily: "Inter",
    fontSize: 32,
    ...overrides,
  }) as Layer;

describe("LayerPanel", () => {
  it("renders layer rows and calls handlers", () => {
    const layers: Layer[] = [
      buildBaseLayer({ layerId: "layer_text", zIndex: 0 }),
      buildBaseLayer({
        layerId: "layer_image",
        layerType: "image",
        layerName: "DESIGN",
        zIndex: 1,
        src: "https://cdn.lumi.test/design.png",
        fabricObject: { type: "image" },
      }),
    ];

    const onSelect = vi.fn();
    const onToggleVisibility = vi.fn();
    const onToggleLock = vi.fn();
    const onReorder = vi.fn();
    const onDuplicate = vi.fn();
    const onDelete = vi.fn();
    const onBringToFront = vi.fn();
    const onSendToBack = vi.fn();

    render(
      <LayerPanel
        layers={layers}
        selectedLayerId="layer_text"
        onSelect={onSelect}
        onToggleVisibility={onToggleVisibility}
        onToggleLock={onToggleLock}
        onReorder={onReorder}
        onDuplicate={onDuplicate}
        onDelete={onDelete}
        onBringToFront={onBringToFront}
        onSendToBack={onSendToBack}
      />,
    );

    expect(screen.getByText("Layers")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("HEADLINE")).toBeInTheDocument();
    expect(screen.getByText("DESIGN")).toBeInTheDocument();

    fireEvent.click(screen.getByText("DESIGN"));
    expect(onSelect).toHaveBeenCalledWith("layer_image");

    const buttons = screen.getAllByRole("button");
    const visibilityButton = buttons.find(
      (button) => button.getAttribute("aria-label") === "Hide layer",
    );
    expect(visibilityButton).toBeDefined();
    if (visibilityButton) {
      fireEvent.click(visibilityButton);
      expect(onToggleVisibility).toHaveBeenCalled();
    }

    const lockButton = buttons.find((button) => button.getAttribute("aria-label") === "Lock layer");
    expect(lockButton).toBeDefined();
    if (lockButton) {
      fireEvent.click(lockButton);
      expect(onToggleLock).toHaveBeenCalled();
    }
  });

  it("opens a context menu on right-click", () => {
    const layers: Layer[] = [buildBaseLayer({ layerId: "layer_text", zIndex: 0 })];

    const onSelect = vi.fn();
    const onToggleVisibility = vi.fn();
    const onToggleLock = vi.fn();
    const onReorder = vi.fn();
    const onDuplicate = vi.fn();
    const onDelete = vi.fn();
    const onBringToFront = vi.fn();
    const onSendToBack = vi.fn();

    render(
      <LayerPanel
        layers={layers}
        onSelect={onSelect}
        onToggleVisibility={onToggleVisibility}
        onToggleLock={onToggleLock}
        onReorder={onReorder}
        onDuplicate={onDuplicate}
        onDelete={onDelete}
        onBringToFront={onBringToFront}
        onSendToBack={onSendToBack}
      />,
    );

    fireEvent.contextMenu(screen.getByText("HEADLINE"), { clientX: 120, clientY: 240 });
    expect(screen.getByRole("menu")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Duplicate"));
    expect(onDuplicate).toHaveBeenCalledWith("layer_text");
  });
});
