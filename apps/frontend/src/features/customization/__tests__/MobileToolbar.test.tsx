import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { MobileToolbar } from "../components/editor/MobileToolbar";

describe("MobileToolbar", () => {
  it("calls onToolChange when selecting a tool", () => {
    const onToolChange = vi.fn();

    render(
      <MobileToolbar
        activeTool="select"
        onToolChange={onToolChange}
        hasSelection={false}
        canUndo={false}
        canRedo={false}
        onUndo={vi.fn()}
        onRedo={vi.fn()}
        onDeleteSelected={vi.fn()}
        onDuplicateSelected={vi.fn()}
        toolPanel={<div>Tool panel</div>}
        propertiesPanel={<div>Properties panel</div>}
        layersPanel={<div>Layers panel</div>}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Text" }));
    expect(onToolChange).toHaveBeenCalledWith("text");
  });

  it("opens the layers panel sheet", () => {
    render(
      <MobileToolbar
        activeTool="select"
        onToolChange={vi.fn()}
        hasSelection
        canUndo={false}
        canRedo={false}
        onUndo={vi.fn()}
        onRedo={vi.fn()}
        onDeleteSelected={vi.fn()}
        onDuplicateSelected={vi.fn()}
        toolPanel={<div>Tool panel</div>}
        propertiesPanel={<div>Properties panel</div>}
        layersPanel={<div>Layers panel</div>}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Layers" }));
    expect(screen.getByText("Layers panel")).toBeInTheDocument();
  });
});
