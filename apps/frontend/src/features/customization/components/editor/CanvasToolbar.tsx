"use client";

import {
  AlignCenter,
  AlignHorizontalJustifyCenter,
  AlignHorizontalJustifyEnd,
  AlignHorizontalJustifyStart,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  AlignVerticalJustifyStart,
  Grid3X3,
  Image as ImageIcon,
  Library,
  MousePointer2,
  Redo2,
  Save,
  Type,
  Undo2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

import type { CanvasAlignAction } from "../../utils/canvas-align";

export type CanvasTool = "select" | "text" | "image" | "library";

interface CanvasToolbarProps {
  activeTool: CanvasTool;
  onToolChange: (tool: CanvasTool) => void;
  canUndo?: boolean;
  canRedo?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
  zoomLabel?: string;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  gridEnabled: boolean;
  onToggleGrid: (enabled: boolean) => void;
  snapEnabled: boolean;
  onToggleSnap: (enabled: boolean) => void;
  onAlign?: (action: CanvasAlignAction) => void;
  onSave?: () => void;
  onExport?: () => void;
  className?: string;
}

const toolConfig = [
  { id: "select", label: "Select", icon: MousePointer2 },
  { id: "text", label: "Text", icon: Type },
  { id: "image", label: "Upload", icon: ImageIcon },
  { id: "library", label: "Library", icon: Library },
] satisfies { id: CanvasTool; label: string; icon: typeof MousePointer2 }[];

export function CanvasToolbar({
  activeTool,
  onToolChange,
  canUndo = false,
  canRedo = false,
  onUndo,
  onRedo,
  zoomLabel,
  onZoomIn,
  onZoomOut,
  gridEnabled,
  onToggleGrid,
  snapEnabled,
  onToggleSnap,
  onAlign,
  onSave,
  onExport,
  className,
}: CanvasToolbarProps): JSX.Element {
  return (
    <section
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/5 px-4 py-3",
        className,
      )}
      aria-label="Canvas toolbar"
    >
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-black/10 p-1">
          {toolConfig.map((tool) => {
            const Icon = tool.icon;
            const isActive = activeTool === tool.id;
            return (
              <Button
                key={tool.id}
                type="button"
                variant={isActive ? "secondary" : "ghost"}
                size="sm"
                className="h-9 gap-2 rounded-lg px-3"
                aria-pressed={isActive}
                onClick={() => onToolChange(tool.id)}
              >
                <Icon className="h-4 w-4" />
                <span className="text-xs font-semibold uppercase tracking-[0.18em]">
                  {tool.label}
                </span>
              </Button>
            );
          })}
        </div>

        <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-black/10 p-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-lg"
            aria-label="Undo"
            disabled={!canUndo}
            onClick={onUndo}
          >
            <Undo2 className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-lg"
            aria-label="Redo"
            disabled={!canRedo}
            onClick={onRedo}
          >
            <Redo2 className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-black/10 p-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-lg"
            aria-label="Zoom out"
            onClick={onZoomOut}
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="min-w-[64px] text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70">
            {zoomLabel ?? "100%"}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-lg"
            aria-label="Zoom in"
            onClick={onZoomIn}
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/10 px-3 py-2">
          <div className="flex items-center gap-2">
            <Grid3X3 className="h-4 w-4 text-white/70" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/70">
              Grid
            </span>
            <Switch checked={gridEnabled} onCheckedChange={onToggleGrid} aria-label="Grid toggle" />
          </div>
          <div className="h-6 w-px bg-white/10" aria-hidden="true" />
          <div className="flex items-center gap-2">
            <AlignCenter className="h-4 w-4 text-white/70" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/70">
              Snap
            </span>
            <Switch
              checked={snapEnabled}
              onCheckedChange={onToggleSnap}
              aria-label="Snap to grid toggle"
            />
          </div>
        </div>

        <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-black/10 p-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-lg"
            aria-label="Align left"
            onClick={() => onAlign?.("left")}
          >
            <AlignHorizontalJustifyStart className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-lg"
            aria-label="Align center"
            onClick={() => onAlign?.("center")}
          >
            <AlignHorizontalJustifyCenter className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-lg"
            aria-label="Align right"
            onClick={() => onAlign?.("right")}
          >
            <AlignHorizontalJustifyEnd className="h-4 w-4" />
          </Button>
          <div className="mx-1 h-6 w-px bg-white/10" aria-hidden="true" />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-lg"
            aria-label="Align top"
            onClick={() => onAlign?.("top")}
          >
            <AlignVerticalJustifyStart className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-lg"
            aria-label="Align middle"
            onClick={() => onAlign?.("middle")}
          >
            <AlignVerticalJustifyCenter className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-lg"
            aria-label="Align bottom"
            onClick={() => onAlign?.("bottom")}
          >
            <AlignVerticalJustifyEnd className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="h-9 gap-2 rounded-xl px-4"
            onClick={onSave}
          >
            <Save className="h-4 w-4" />
            <span className="text-xs font-semibold uppercase tracking-[0.18em]">Save</span>
          </Button>
          <Button
            type="button"
            variant="default"
            size="sm"
            className="h-9 gap-2 rounded-xl px-4"
            onClick={onExport}
          >
            <span className="text-xs font-semibold uppercase tracking-[0.18em]">Export</span>
          </Button>
        </div>
      </div>
    </section>
  );
}
