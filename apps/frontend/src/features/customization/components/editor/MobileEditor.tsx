"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import type * as fabric from "fabric";

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { toast } from "@/hooks/use-toast";
import { apiClient } from "@/lib/api-client";
import { cn } from "@/lib/utils";

import type { DesignArea } from "../../types/design-area.types";
import type { Layer } from "../../types/layer.types";
import type { DesignTemplateSummaryView } from "../../types/templates.types";
import { designTemplateViewSchema } from "../../types/templates.types";
import { useCanvasHistory } from "../../hooks/useCanvasHistory";
import { addClipartSvgToCanvas, addCustomerDesignToCanvas } from "../../utils/canvas-assets";
import { setAlignmentGuidesEnabled } from "../../utils/alignment-guides";
import {
  deserializeLayer,
  createLayerId,
  ensureFabricLayerMetadata,
} from "../../utils/layer-serialization";
import { extractTemplateLayers } from "../../utils/template-canvas-data";
import { SelectTool } from "../tools/SelectTool";
import { TextTool } from "../tools/TextTool";
import type { CanvasTool } from "./CanvasToolbar";
import { DesignCanvas } from "./DesignCanvas";
import { DesignLibrary } from "./DesignLibrary";
import { ImageUploader } from "./ImageUploader";
import { LayerPanel } from "./LayerPanel";
import { MobileToolbar } from "./MobileToolbar";
import { PropertiesPanel } from "./PropertiesPanel";
import { TouchControls } from "./TouchControls";

const MAX_MOBILE_LAYERS = 10;
const ROTATION_SNAP_STEP = 15;

const clampLayerName = (value: string) => value.trim().slice(0, 32);

const findObjectByLayerId = (canvas: fabric.Canvas, layerId: string) =>
  canvas.getObjects().find((object) => {
    const raw = object as unknown as Record<string, unknown>;
    return raw.layerId === layerId;
  });

const updateObjectMetadata = (object: fabric.Object, patch: Record<string, unknown>) => {
  const raw = object as unknown as Record<string, unknown>;
  Object.assign(raw, patch);
};

const clearObjects = (canvas: fabric.Canvas) => {
  canvas.getObjects().forEach((object) => canvas.remove(object));
  canvas.discardActiveObject();
};

const vibrate = (pattern: number | number[]) => {
  if (typeof navigator === "undefined") return;
  if (typeof navigator.vibrate !== "function") return;
  navigator.vibrate(pattern);
};

const resolveLowEndDevice = (): boolean => {
  const nav = navigator as unknown as { deviceMemory?: unknown; hardwareConcurrency?: unknown };
  const deviceMemory = typeof nav.deviceMemory === "number" ? nav.deviceMemory : undefined;
  const cores = typeof nav.hardwareConcurrency === "number" ? nav.hardwareConcurrency : undefined;

  if (typeof deviceMemory === "number") {
    return deviceMemory <= 4;
  }

  return typeof cores === "number" ? cores <= 4 : false;
};

const applyMobileObjectControls = (object: fabric.Object): void => {
  object.set({
    cornerSize: 24,
    touchCornerSize: 36,
    transparentCorners: false,
    cornerStyle: "circle",
    cornerColor: "rgba(96,165,250,0.9)",
    borderColor: "rgba(96,165,250,0.85)",
  });
  object.setCoords();
};

interface MobileEditorProps {
  productImageUrl: string;
  designArea: DesignArea;
  initialLayers?: Layer[];
  readOnly?: boolean;
  className?: string;
}

export function MobileEditor({
  productImageUrl,
  designArea,
  initialLayers,
  readOnly = false,
  className,
}: MobileEditorProps): JSX.Element {
  const [canvas, setCanvas] = useState<fabric.Canvas | undefined>();
  const [layers, setLayers] = useState<Layer[]>([]);
  const [selectedLayer, setSelectedLayer] = useState<Layer | undefined>();
  const [activeTool, setActiveTool] = useState<CanvasTool>("select");
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [contextMenuOpen, setContextMenuOpen] = useState(false);

  const history = useCanvasHistory({ canvas, layers });

  const loadTemplate = useCallback(
    async (template: Pick<DesignTemplateSummaryView, "id" | "name">) => {
      if (readOnly) return;
      if (!canvas) {
        toast({
          title: "Canvas not ready",
          description: "Please wait for the editor to initialize.",
        });
        return;
      }

      try {
        const response = await apiClient.get(`/templates/${template.id}`, {
          dataSchema: designTemplateViewSchema,
        });

        const editorLayers = extractTemplateLayers(response.data.canvasData);
        if (!editorLayers || editorLayers.length === 0) {
          throw new Error("This template cannot be restored (missing layer data).");
        }

        if (editorLayers.length > MAX_MOBILE_LAYERS) {
          toast({
            title: "Template truncated",
            description: `This template has ${editorLayers.length} layers. Mobile supports ${MAX_MOBILE_LAYERS}.`,
          });
        }

        clearObjects(canvas);

        const orderedLayers = [...editorLayers]
          .sort((left, right) => left.zIndex - right.zIndex)
          .slice(0, MAX_MOBILE_LAYERS);

        const results = await Promise.allSettled(
          orderedLayers.map((layer) => deserializeLayer(layer)),
        );

        let restored = 0;
        let failed = 0;

        results.forEach((result) => {
          if (result.status === "fulfilled") {
            canvas.add(result.value);
            restored += 1;
            return;
          }

          failed += 1;
        });

        canvas.requestRenderAll();

        toast({
          title: "Template loaded",
          description: `${template.name} applied (${restored} layer${restored === 1 ? "" : "s"}).`,
        });

        if (failed > 0) {
          toast({
            title: "Partial restore",
            description: `${failed} layer(s) could not be restored (missing images or unsupported data).`,
          });
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unable to load template into the editor.";
        toast({
          title: "Template load failed",
          description: message,
          variant: "destructive",
        });
      }
    },
    [canvas, readOnly],
  );

  useEffect(() => {
    if (!canvas) return;

    setAlignmentGuidesEnabled(canvas, false);
    (canvas as unknown as { lumiRotationSnapStep?: number }).lumiRotationSnapStep =
      ROTATION_SNAP_STEP;

    if (resolveLowEndDevice()) {
      (canvas as unknown as { enableRetinaScaling?: boolean }).enableRetinaScaling = false;
      canvas.requestRenderAll();
    }
  }, [canvas]);

  useEffect(() => {
    if (!canvas) return () => {};

    const handleSelection = () => {
      if (readOnly) return;
      vibrate(10);
    };

    canvas.on("selection:created", handleSelection);
    canvas.on("selection:updated", handleSelection);

    return () => {
      canvas.off("selection:created", handleSelection);
      canvas.off("selection:updated", handleSelection);
    };
  }, [canvas, readOnly]);

  useEffect(() => {
    if (!canvas || readOnly) return () => {};

    const handleAdded = (event: { target?: fabric.Object }) => {
      const { target } = event;
      if (target) {
        applyMobileObjectControls(target);
      }

      const count = canvas.getObjects().length;
      if (count <= MAX_MOBILE_LAYERS) return;
      if (!target) return;

      canvas.remove(target);
      canvas.discardActiveObject();
      canvas.requestRenderAll();
      vibrate([15, 30, 15]);
      toast({
        title: "Layer limit reached",
        description: `Mobile editor supports up to ${MAX_MOBILE_LAYERS} layers.`,
      });
    };

    canvas.on("object:added", handleAdded);
    canvas.forEachObject((object) => applyMobileObjectControls(object));

    return () => {
      canvas.off("object:added", handleAdded);
    };
  }, [canvas, readOnly]);

  const handleToolChange = useCallback((tool: CanvasTool) => {
    setActiveTool(tool);
    if (tool === "library") {
      setLibraryOpen(true);
    }
  }, []);

  const handleSwipeTool = useCallback(
    (direction: "left" | "right") => {
      const tools: CanvasTool[] = ["select", "text", "image", "library"];
      const index = tools.indexOf(activeTool);
      const delta = direction === "left" ? 1 : -1;
      const next = tools[(index + delta + tools.length) % tools.length] ?? "select";
      handleToolChange(next);
    },
    [activeTool, handleToolChange],
  );

  const handleSelectLayer = useCallback(
    (layerId: string) => {
      if (!canvas) return;
      const object = findObjectByLayerId(canvas, layerId);
      if (!object) return;
      canvas.setActiveObject(object);
      canvas.requestRenderAll();
    },
    [canvas],
  );

  const handleToggleVisibility = useCallback(
    (layerId: string, hidden: boolean) => {
      if (!canvas) return;
      const object = findObjectByLayerId(canvas, layerId);
      if (!object) return;
      updateObjectMetadata(object, { isHidden: hidden });
      object.set({ visible: !hidden });
      object.setCoords();
      canvas.requestRenderAll();
      canvas.fire("object:modified", { target: object });
    },
    [canvas],
  );

  const handleToggleLock = useCallback(
    (layerId: string, locked: boolean) => {
      if (!canvas) return;
      const object = findObjectByLayerId(canvas, layerId);
      if (!object) return;
      updateObjectMetadata(object, { isLocked: locked });
      object.set({
        selectable: !locked,
        evented: !locked,
      });
      object.setCoords();
      canvas.discardActiveObject();
      canvas.requestRenderAll();
      canvas.fire("object:modified", { target: object });
    },
    [canvas],
  );

  const handleReorder = useCallback(
    (fromIndex: number, toIndex: number) => {
      if (!canvas) return;
      const objects = canvas.getObjects();
      const target = objects[fromIndex];
      if (!target) return;
      canvas.moveObjectTo(target, toIndex);
      canvas.requestRenderAll();
      canvas.fire("object:modified", { target });
    },
    [canvas],
  );

  const handleBringToFront = useCallback(
    (layerId: string) => {
      if (!canvas) return;
      const object = findObjectByLayerId(canvas, layerId);
      if (!object) return;
      canvas.bringObjectToFront(object);
      canvas.requestRenderAll();
      canvas.fire("object:modified", { target: object });
    },
    [canvas],
  );

  const handleSendToBack = useCallback(
    (layerId: string) => {
      if (!canvas) return;
      const object = findObjectByLayerId(canvas, layerId);
      if (!object) return;
      canvas.sendObjectToBack(object);
      canvas.requestRenderAll();
      canvas.fire("object:modified", { target: object });
    },
    [canvas],
  );

  const handleDuplicate = useCallback(
    async (layerId: string) => {
      if (!canvas) return;
      const target = findObjectByLayerId(canvas, layerId);
      if (!target) return;

      const clone = await (
        target as unknown as { clone: (props?: string[]) => Promise<fabric.Object> }
      ).clone([]);

      const raw = clone as unknown as Record<string, unknown>;
      const layerName = typeof raw.layerName === "string" ? raw.layerName : "LAYER";

      ensureFabricLayerMetadata(clone, {
        layerId: createLayerId("layer"),
        layerName: clampLayerName(`${layerName} COPY`),
        isHidden: false,
        isLocked: false,
        zIndex: canvas.getObjects().length,
      });

      applyMobileObjectControls(clone);

      clone.set({
        left: (clone.left ?? 0) + 12,
        top: (clone.top ?? 0) + 12,
      });

      canvas.add(clone);
      canvas.setActiveObject(clone);
      canvas.requestRenderAll();
      canvas.fire("object:modified", { target: clone });
      vibrate(10);
      toast({ title: "Duplicated", description: "Layer duplicated on canvas." });
    },
    [canvas],
  );

  const handleDelete = useCallback(
    (layerId: string) => {
      if (!canvas) return;
      const object = findObjectByLayerId(canvas, layerId);
      if (!object) return;
      canvas.remove(object);
      canvas.discardActiveObject();
      canvas.requestRenderAll();
      vibrate([10, 30, 10]);
      toast({ title: "Deleted", description: "Layer removed from canvas." });
    },
    [canvas],
  );

  const activeToolPanel = useMemo(() => {
    if (activeTool === "text") {
      return <TextTool canvas={canvas} active className="h-full" />;
    }

    if (activeTool === "image") {
      return <ImageUploader canvas={canvas} className="h-full" compressionPreset="mobile" />;
    }

    return <SelectTool canvas={canvas} active={activeTool === "select"} className="h-full" />;
  }, [activeTool, canvas]);

  const layersPanel = useMemo(
    () => (
      <LayerPanel
        layers={layers}
        selectedLayerId={selectedLayer?.layerId}
        onSelect={handleSelectLayer}
        onToggleVisibility={handleToggleVisibility}
        onToggleLock={handleToggleLock}
        onReorder={handleReorder}
        onDuplicate={(layerId) => {
          handleDuplicate(layerId).catch(() => {});
        }}
        onDelete={handleDelete}
        onBringToFront={handleBringToFront}
        onSendToBack={handleSendToBack}
      />
    ),
    [
      handleDelete,
      handleDuplicate,
      handleBringToFront,
      handleReorder,
      handleSelectLayer,
      handleSendToBack,
      handleToggleLock,
      handleToggleVisibility,
      layers,
      selectedLayer?.layerId,
    ],
  );

  const propertiesPanel = useMemo(
    () => <PropertiesPanel canvas={canvas} readOnly={readOnly} className="h-full" />,
    [canvas, readOnly],
  );

  const selectedId = selectedLayer?.layerId;

  const contextTarget = useMemo(() => {
    if (!canvas) return selectedId;
    const active = canvas.getActiveObject();
    if (!active || active.type === "activeSelection") return selectedId;
    const raw = active as unknown as Record<string, unknown>;
    const layerId = typeof raw.layerId === "string" ? raw.layerId : undefined;
    return layerId ?? selectedId;
  }, [canvas, selectedId]);

  const contextLayerMeta = useMemo(() => {
    let meta: { id: string; name: string } | undefined;

    if (contextTarget) {
      const layer = layers.find((entry) => entry.layerId === contextTarget);
      meta = layer
        ? { id: layer.layerId, name: layer.layerName }
        : { id: contextTarget, name: "LAYER" };
    }

    return meta;
  }, [contextTarget, layers]);

  return (
    <div className={cn("relative h-[100dvh] w-full bg-black/5", className)}>
      <div className="absolute inset-0 flex flex-col">
        <main className="flex-1 px-3 pb-24 pt-3">
          <div className="h-full rounded-2xl border border-white/10 bg-black/5 p-3">
            <DesignCanvas
              productImageUrl={productImageUrl}
              designArea={designArea}
              initialLayers={initialLayers}
              onLayerChange={setLayers}
              onSelectionChange={setSelectedLayer}
              onCanvasReady={setCanvas}
              readOnly={readOnly}
              className="h-full transform-gpu"
            />
          </div>
        </main>

        <TouchControls
          canvas={canvas}
          onSwipeTool={handleSwipeTool}
          onLongPress={() => {
            if (!contextTarget) return;
            setContextMenuOpen(true);
            vibrate(10);
          }}
        />

        <MobileToolbar
          activeTool={activeTool}
          onToolChange={handleToolChange}
          hasSelection={Boolean(selectedLayer)}
          canUndo={history.canUndo}
          canRedo={history.canRedo}
          onUndo={() => {
            history.undo().catch(() => {});
          }}
          onRedo={() => {
            history.redo().catch(() => {});
          }}
          onDeleteSelected={() => {
            if (!selectedId) return;
            handleDelete(selectedId);
          }}
          onDuplicateSelected={() => {
            if (!selectedId) return;
            handleDuplicate(selectedId).catch(() => {});
          }}
          toolPanel={activeToolPanel}
          propertiesPanel={propertiesPanel}
          layersPanel={layersPanel}
          readOnly={readOnly}
        />
      </div>

      <DesignLibrary
        open={libraryOpen}
        onOpenChange={(open) => {
          setLibraryOpen(open);
          if (!open && activeTool === "library") {
            setActiveTool("select");
          }
        }}
        onSelectDesign={(design) => {
          if (!canvas) return;
          addCustomerDesignToCanvas({
            canvas,
            design,
            layerName: clampLayerName(`DESIGN ${design.id.slice(-4)}`),
          }).catch(() => {});
        }}
        onSelectClipart={(asset) => {
          if (!canvas) return;
          addClipartSvgToCanvas({
            canvas,
            svg: asset.svg,
            layerName: clampLayerName(asset.name.toUpperCase()),
            clipartId: asset.id,
            isPaid: asset.isPaid,
          }).catch(() => {});
        }}
        onSelectTemplate={(template) => {
          loadTemplate(template).catch(() => {});
        }}
      />

      <Sheet open={contextMenuOpen} onOpenChange={setContextMenuOpen}>
        <SheetContent
          side="bottom"
          className="rounded-t-3xl border-white/10 bg-black/90 px-4 pb-6 pt-4 text-white"
        >
          <div className="mx-auto mb-4 h-1.5 w-14 rounded-full bg-white/10" aria-hidden="true" />
          <SheetHeader className="space-y-1 pb-3">
            <SheetTitle className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/80">
              Context menu
            </SheetTitle>
            {contextLayerMeta && (
              <p className="text-[11px] text-white/50">
                {contextLayerMeta.name} · {contextLayerMeta.id}
              </p>
            )}
          </SheetHeader>

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-white/80 transition hover:bg-white/5"
              onClick={() => {
                if (!contextTarget) return;
                handleDuplicate(contextTarget).catch(() => {});
                setContextMenuOpen(false);
              }}
              disabled={readOnly || !contextTarget}
            >
              Duplicate
            </button>
            <button
              type="button"
              className="rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-4 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-red-100 transition hover:bg-red-500/15"
              onClick={() => {
                if (!contextTarget) return;
                handleDelete(contextTarget);
                setContextMenuOpen(false);
              }}
              disabled={readOnly || !contextTarget}
            >
              Delete
            </button>
            <button
              type="button"
              className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-white/80 transition hover:bg-white/5"
              onClick={() => {
                if (!canvas || !contextTarget) return;
                const object = findObjectByLayerId(canvas, contextTarget);
                if (!object) return;
                const raw = object as unknown as Record<string, unknown>;
                const locked = Boolean(raw.isLocked);
                handleToggleLock(contextTarget, !locked);
                setContextMenuOpen(false);
              }}
              disabled={readOnly || !contextTarget}
            >
              Lock / unlock
            </button>
            <button
              type="button"
              className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-white/80 transition hover:bg-white/5"
              onClick={() => {
                if (!canvas || !contextTarget) return;
                const object = findObjectByLayerId(canvas, contextTarget);
                if (!object) return;
                const raw = object as unknown as Record<string, unknown>;
                const hidden = Boolean(raw.isHidden) || object.visible === false;
                handleToggleVisibility(contextTarget, !hidden);
                setContextMenuOpen(false);
              }}
              disabled={readOnly || !contextTarget}
            >
              Hide / show
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
