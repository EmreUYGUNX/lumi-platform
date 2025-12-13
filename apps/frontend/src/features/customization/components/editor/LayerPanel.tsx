"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import {
  Eye,
  EyeOff,
  Image as ImageIcon,
  Layers,
  Lock,
  LockOpen,
  Shapes,
  Type,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import type { Layer, LayerType } from "../../types/layer.types";

interface LayerPanelProps {
  layers: Layer[];
  selectedLayerId?: string;
  onSelect: (layerId: string) => void;
  onToggleVisibility: (layerId: string, hidden: boolean) => void;
  onToggleLock: (layerId: string, locked: boolean) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
  onDuplicate: (layerId: string) => void;
  onDelete: (layerId: string) => void;
  onBringToFront: (layerId: string) => void;
  onSendToBack: (layerId: string) => void;
}

interface ContextMenuState {
  layerId: string;
  x: number;
  y: number;
}

const layerIcons = {
  text: Type,
  image: ImageIcon,
  clipart: Shapes,
  group: Layers,
  shape: Shapes,
} satisfies Record<LayerType, typeof Layers>;

const layerIcon = (type: LayerType) => layerIcons[type];

export function LayerPanel({
  layers,
  selectedLayerId,
  onSelect,
  onToggleVisibility,
  onToggleLock,
  onReorder,
  onDuplicate,
  onDelete,
  onBringToFront,
  onSendToBack,
}: LayerPanelProps): JSX.Element {
  const [draggingLayerId, setDraggingLayerId] = useState<string | undefined>();
  const [contextMenu, setContextMenu] = useState<ContextMenuState | undefined>();
  const contextMenuRef = useRef<HTMLDivElement | null>(null);

  const orderedLayers = useMemo(() => [...layers].sort((a, b) => a.zIndex - b.zIndex), [layers]);

  useEffect(() => {
    if (!contextMenu) return () => {};

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setContextMenu(undefined);
      }
    };
    const handlePointer = (event: PointerEvent) => {
      const menu = contextMenuRef.current;
      if (menu && event.target instanceof Node && menu.contains(event.target)) {
        return;
      }
      setContextMenu(undefined);
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("pointerdown", handlePointer);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("pointerdown", handlePointer);
    };
  }, [contextMenu]);

  return (
    <section className="flex h-full flex-col gap-3 rounded-2xl border border-white/10 bg-black/5 p-4">
      <header className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-white/70" />
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/80">
            Layers
          </h2>
        </div>
        <span className="text-[10px] uppercase tracking-[0.22em] text-white/50">
          {orderedLayers.length}
        </span>
      </header>

      <div className="flex-1 overflow-auto pr-1">
        <ul className="space-y-2">
          {orderedLayers.map((layer, index) => {
            const Icon = layerIcon(layer.layerType);
            const isSelected = layer.layerId === selectedLayerId;
            const isDragging = layer.layerId === draggingLayerId;
            const thumbnailSrc =
              (layer.layerType === "image" || layer.layerType === "clipart") && "src" in layer
                ? layer.src
                : undefined;

            return (
              <li
                key={layer.layerId}
                draggable
                onDragStart={() => {
                  setDraggingLayerId(layer.layerId);
                }}
                onDragEnd={() => {
                  setDraggingLayerId(undefined);
                }}
                onDragOver={(event) => {
                  event.preventDefault();
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  if (!draggingLayerId) return;
                  const fromIndex = orderedLayers.findIndex(
                    (candidate) => candidate.layerId === draggingLayerId,
                  );
                  const toIndex = index;
                  if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return;
                  onReorder(fromIndex, toIndex);
                }}
                onContextMenu={(event) => {
                  event.preventDefault();
                  setContextMenu({ layerId: layer.layerId, x: event.clientX, y: event.clientY });
                }}
                className={cn(
                  "flex items-center justify-between gap-3 rounded-xl border px-3 py-2 transition",
                  "bg-black/10 hover:bg-black/20",
                  isSelected ? "border-white/30" : "border-white/10",
                  isDragging ? "opacity-60" : "opacity-100",
                )}
              >
                <button
                  type="button"
                  className="flex flex-1 items-center gap-3 text-left"
                  onClick={() => onSelect(layer.layerId)}
                >
                  <span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-lg bg-black/20">
                    {thumbnailSrc ? (
                      // eslint-disable-next-line @next/next/no-img-element -- Editor thumbnails are rendered from user-selected assets.
                      <img src={thumbnailSrc} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <Icon className="h-4 w-4 text-white/70" />
                    )}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[11px] font-semibold uppercase tracking-[0.22em] text-white/80">
                      {layer.layerName}
                    </span>
                    <span className="block text-[10px] uppercase tracking-[0.18em] text-white/50">
                      {layer.layerType}
                    </span>
                  </span>
                </button>

                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-9 w-9 rounded-lg"
                    aria-label={layer.isHidden ? "Show layer" : "Hide layer"}
                    onClick={() => onToggleVisibility(layer.layerId, !layer.isHidden)}
                  >
                    {layer.isHidden ? (
                      <EyeOff className="h-4 w-4 text-white/60" />
                    ) : (
                      <Eye className="h-4 w-4 text-white/60" />
                    )}
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-9 w-9 rounded-lg"
                    aria-label={layer.isLocked ? "Unlock layer" : "Lock layer"}
                    onClick={() => onToggleLock(layer.layerId, !layer.isLocked)}
                  >
                    {layer.isLocked ? (
                      <Lock className="h-4 w-4 text-white/60" />
                    ) : (
                      <LockOpen className="h-4 w-4 text-white/60" />
                    )}
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="fixed z-50 min-w-[180px] rounded-xl border border-white/10 bg-black/80 p-2 text-white shadow-xl backdrop-blur"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          role="menu"
        >
          <button
            type="button"
            className="w-full rounded-lg px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.2em] hover:bg-white/10"
            onClick={() => {
              onDuplicate(contextMenu.layerId);
              setContextMenu(undefined);
            }}
          >
            Duplicate
          </button>
          <button
            type="button"
            className="w-full rounded-lg px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.2em] hover:bg-white/10"
            onClick={() => {
              onBringToFront(contextMenu.layerId);
              setContextMenu(undefined);
            }}
          >
            Bring To Front
          </button>
          <button
            type="button"
            className="w-full rounded-lg px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.2em] hover:bg-white/10"
            onClick={() => {
              onSendToBack(contextMenu.layerId);
              setContextMenu(undefined);
            }}
          >
            Send To Back
          </button>
          <button
            type="button"
            className="w-full rounded-lg px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.2em] hover:bg-white/10"
            onClick={() => {
              const layer = orderedLayers.find(
                (candidate) => candidate.layerId === contextMenu.layerId,
              );
              if (layer) onToggleLock(layer.layerId, !layer.isLocked);
              setContextMenu(undefined);
            }}
          >
            Lock/Unlock
          </button>
          <button
            type="button"
            className="w-full rounded-lg px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.2em] hover:bg-white/10"
            onClick={() => {
              const layer = orderedLayers.find(
                (candidate) => candidate.layerId === contextMenu.layerId,
              );
              if (layer) onToggleVisibility(layer.layerId, !layer.isHidden);
              setContextMenu(undefined);
            }}
          >
            Show/Hide
          </button>
          <button
            type="button"
            className="w-full rounded-lg px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.2em] text-red-200 hover:bg-white/10"
            onClick={() => {
              onDelete(contextMenu.layerId);
              setContextMenu(undefined);
            }}
          >
            Delete
          </button>
        </div>
      )}
    </section>
  );
}
