"use client";

import { useEffect } from "react";

import type * as fabric from "fabric";
import { MousePointer2 } from "lucide-react";

import { cn } from "@/lib/utils";

interface SelectToolProps {
  canvas?: fabric.Canvas;
  active: boolean;
  className?: string;
}

export function SelectTool({ canvas, active, className }: SelectToolProps): JSX.Element {
  useEffect(() => {
    const resolvedCanvas = canvas;
    if (!resolvedCanvas || !active) return () => {};

    resolvedCanvas.selection = true;
    resolvedCanvas.skipTargetFind = false;
    resolvedCanvas.defaultCursor = "default";
    resolvedCanvas.hoverCursor = "move";

    resolvedCanvas.forEachObject((object) => {
      object.set({
        hasControls: true,
        hasBorders: true,
      });
    });

    resolvedCanvas.requestRenderAll();

    return () => {};
  }, [active, canvas]);

  return (
    <section
      className={cn(
        "flex flex-col gap-4 rounded-2xl border border-white/10 bg-black/5 p-4 text-white/80",
        className,
      )}
      aria-label="Select tool"
    >
      <header className="flex items-center gap-2">
        <MousePointer2 className="h-4 w-4 text-white/70" />
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.28em]">Select</h3>
      </header>

      <ul className="space-y-2 text-[11px] leading-relaxed text-white/70">
        <li>Click objects to select and edit.</li>
        <li>Drag to move; use handles to resize/rotate.</li>
        <li>Hold Shift for multi-select or box selection.</li>
      </ul>
    </section>
  );
}
