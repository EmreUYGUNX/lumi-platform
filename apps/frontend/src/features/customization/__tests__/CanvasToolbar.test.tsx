import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { CanvasToolbar } from "../components/editor/CanvasToolbar";

describe("CanvasToolbar", () => {
  it("renders tool buttons and calls handlers", () => {
    const onToolChange = vi.fn();
    const onToggleGrid = vi.fn();
    const onToggleSnap = vi.fn();
    const onAlign = vi.fn();
    const onSave = vi.fn();
    const onExport = vi.fn();

    render(
      <CanvasToolbar
        activeTool="select"
        onToolChange={onToolChange}
        canUndo={false}
        canRedo={false}
        onUndo={vi.fn()}
        onRedo={vi.fn()}
        zoomLabel="120%"
        onZoomIn={vi.fn()}
        onZoomOut={vi.fn()}
        gridEnabled={false}
        onToggleGrid={onToggleGrid}
        snapEnabled={false}
        onToggleSnap={onToggleSnap}
        onAlign={onAlign}
        onSave={onSave}
        onExport={onExport}
      />,
    );

    expect(screen.getByLabelText("Canvas toolbar")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Text"));
    expect(onToolChange).toHaveBeenCalledWith("text");

    fireEvent.click(screen.getByLabelText("Grid toggle"));
    expect(onToggleGrid).toHaveBeenCalled();

    fireEvent.click(screen.getByLabelText("Snap to grid toggle"));
    expect(onToggleSnap).toHaveBeenCalled();

    fireEvent.click(screen.getByLabelText("Align left"));
    expect(onAlign).toHaveBeenCalledWith("left");

    fireEvent.click(screen.getByText("Save"));
    expect(onSave).toHaveBeenCalled();

    fireEvent.click(screen.getByText("Export"));
    expect(onExport).toHaveBeenCalled();
  });

  it("disables undo/redo when unavailable", () => {
    render(
      <CanvasToolbar
        activeTool="select"
        onToolChange={vi.fn()}
        canUndo={false}
        canRedo={false}
        onUndo={vi.fn()}
        onRedo={vi.fn()}
        gridEnabled={false}
        onToggleGrid={vi.fn()}
        snapEnabled={false}
        onToggleSnap={vi.fn()}
      />,
    );

    const undoButton = screen.getByLabelText("Undo") as HTMLButtonElement;
    const redoButton = screen.getByLabelText("Redo") as HTMLButtonElement;

    expect(undoButton.disabled).toBe(true);
    expect(redoButton.disabled).toBe(true);
  });
});
