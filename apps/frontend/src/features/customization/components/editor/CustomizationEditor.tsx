"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import * as fabric from "fabric";

import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

import type { DesignArea } from "../../types/design-area.types";
import type { Layer } from "../../types/layer.types";
import { useCanvasHistory } from "../../hooks/useCanvasHistory";
import { useCanvasZoom } from "../../hooks/useCanvasZoom";
import { alignActiveSelection } from "../../utils/canvas-align";
import { addClipartSvgToCanvas, addCustomerDesignToCanvas } from "../../utils/canvas-assets";
import { setGridOverlayEnabled, setSnapToGridEnabled } from "../../utils/fabric-canvas";
import { createLayerId, ensureFabricLayerMetadata } from "../../utils/layer-serialization";
import { SelectTool } from "../tools/SelectTool";
import { TextTool } from "../tools/TextTool";
import { CanvasToolbar, type CanvasTool } from "./CanvasToolbar";
import { DesignCanvas } from "./DesignCanvas";
import { DesignLibrary } from "./DesignLibrary";
import { ImageUploader } from "./ImageUploader";
import { LayerPanel } from "./LayerPanel";

const DRAFT_STORAGE_KEY = "lumi.editor.draft";

const downloadJson = (filename: string, payload: unknown) => {
  const blob = new Blob([JSON.stringify(payload, undefined, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
};

const findObjectByLayerId = (canvas: fabric.Canvas, layerId: string) =>
  canvas.getObjects().find((object) => {
    const raw = object as unknown as Record<string, unknown>;
    return raw.layerId === layerId;
  });

const updateObjectMetadata = (object: fabric.Object, patch: Record<string, unknown>) => {
  const raw = object as unknown as Record<string, unknown>;
  Object.assign(raw, patch);
};

const clampLayerName = (value: string) => value.trim().slice(0, 32);

const clearObjects = (canvas: fabric.Canvas) => {
  canvas.getObjects().forEach((object) => canvas.remove(object));
  canvas.discardActiveObject();
};

interface CustomizationEditorProps {
  productImageUrl: string;
  designArea: DesignArea;
  initialLayers?: Layer[];
  readOnly?: boolean;
  className?: string;
}

export function CustomizationEditor({
  productImageUrl,
  designArea,
  initialLayers,
  readOnly = false,
  className,
}: CustomizationEditorProps): JSX.Element {
  const [canvas, setCanvas] = useState<fabric.Canvas | undefined>();
  const [layers, setLayers] = useState<Layer[]>([]);
  const [selectedLayer, setSelectedLayer] = useState<Layer | undefined>();

  const [activeTool, setActiveTool] = useState<CanvasTool>("select");
  const [gridEnabled, setGridEnabled] = useState(false);
  const [snapEnabled, setSnapEnabled] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);

  const history = useCanvasHistory({ canvas, layers });
  const zoom = useCanvasZoom({ canvas });

  useEffect(() => {
    if (!canvas) return;
    setGridOverlayEnabled(canvas, gridEnabled);
    setSnapToGridEnabled(canvas, snapEnabled);
  }, [canvas, gridEnabled, snapEnabled]);

  const handleToolChange = useCallback((tool: CanvasTool) => {
    setActiveTool(tool);
    if (tool === "library") {
      setLibraryOpen(true);
    }
  }, []);

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

      clone.set({
        left: (clone.left ?? 0) + 12,
        top: (clone.top ?? 0) + 12,
      });

      canvas.add(clone);
      canvas.setActiveObject(clone);
      canvas.requestRenderAll();
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
    },
    [canvas],
  );

  const handleAlign = useCallback(
    (action: Parameters<typeof alignActiveSelection>[1]) => {
      if (!canvas) return;
      alignActiveSelection(canvas, action);
    },
    [canvas],
  );

  const saveDraft = useCallback(() => {
    const payload = {
      productImageUrl,
      designArea,
      layers,
      savedAt: new Date().toISOString(),
    };

    try {
      window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(payload));
      toast({ title: "Saved", description: "Design draft saved locally." });
    } catch {
      toast({ title: "Save failed", description: "Unable to save draft in this browser." });
    }
  }, [designArea, layers, productImageUrl]);

  const exportDesign = useCallback(() => {
    downloadJson(`design-${createLayerId("export")}.json`, {
      productImageUrl,
      designArea,
      layers,
    });
    toast({ title: "Exported", description: "Design JSON downloaded." });
  }, [designArea, layers, productImageUrl]);

  const loadTemplate = useCallback(
    (templateId: string) => {
      if (!canvas) return;

      clearObjects(canvas);

      const designWidth = (canvas as unknown as { lumiDesignWidth?: number }).lumiDesignWidth;
      const designHeight = (canvas as unknown as { lumiDesignHeight?: number }).lumiDesignHeight;
      const bounds = {
        width: typeof designWidth === "number" ? designWidth : canvas.getWidth(),
        height: typeof designHeight === "number" ? designHeight : canvas.getHeight(),
      };

      const addText = (text: string, options: Partial<fabric.ITextProps> = {}) => {
        const textbox = new fabric.Textbox(text, {
          left: bounds.width / 2,
          top: bounds.height / 2,
          originX: "center",
          originY: "center",
          width: Math.min(420, bounds.width),
          fontFamily: "Inter",
          fontSize: 64,
          fontWeight: "800",
          textAlign: "center",
          fill: "#111827",
          ...options,
        });

        ensureFabricLayerMetadata(textbox, {
          layerId: createLayerId("text"),
          layerType: "text",
          layerName: "TEMPLATE TEXT",
          zIndex: canvas.getObjects().length,
          customData: { templateId },
        });

        canvas.add(textbox);
      };

      if (templateId === "template-sale") {
        const circle = new fabric.Circle({
          left: bounds.width / 2,
          top: bounds.height / 2,
          originX: "center",
          originY: "center",
          radius: Math.min(bounds.width, bounds.height) * 0.22,
          fill: "#ef4444",
        });
        ensureFabricLayerMetadata(circle, {
          layerId: createLayerId("shape"),
          layerType: "shape",
          layerName: "BADGE",
          zIndex: canvas.getObjects().length,
          customData: { templateId },
        });
        canvas.add(circle);
        addText("SALE", { fontSize: 54, fill: "#ffffff" });
      } else if (templateId === "template-bold") {
        addText("BOLD", {
          fontSize: 84,
          fill: "#111827",
          stroke: "#ffffff",
          strokeWidth: 3,
        });
      } else {
        addText("LUMI", { fontSize: 72, fontWeight: "700" });
        addText("CUSTOM", { top: bounds.height / 2 + 64, fontSize: 26, fontWeight: "500" });
      }

      canvas.requestRenderAll();
    },
    [canvas],
  );

  const editorReady = Boolean(canvas);

  const secondaryPanel = useMemo(() => {
    if (activeTool === "text") {
      return <TextTool canvas={canvas} active className="h-full" />;
    }

    if (activeTool === "image") {
      return <ImageUploader canvas={canvas} className="h-full" />;
    }

    return <SelectTool canvas={canvas} active={activeTool === "select"} className="h-full" />;
  }, [activeTool, canvas]);

  const wrapperClassName = useMemo(() => cn("grid h-full gap-4", className), [className]);

  return (
    <div className={wrapperClassName}>
      <CanvasToolbar
        activeTool={activeTool}
        onToolChange={handleToolChange}
        canUndo={history.canUndo}
        canRedo={history.canRedo}
        onUndo={() => {
          history.undo().catch(() => {});
        }}
        onRedo={() => {
          history.redo().catch(() => {});
        }}
        zoomLabel={zoom.zoomLabel}
        onZoomIn={zoom.zoomIn}
        onZoomOut={zoom.zoomOut}
        gridEnabled={gridEnabled}
        onToggleGrid={setGridEnabled}
        snapEnabled={snapEnabled}
        onToggleSnap={setSnapEnabled}
        onAlign={handleAlign}
        onSave={saveDraft}
        onExport={exportDesign}
      />

      <div className="grid flex-1 grid-cols-1 gap-4 lg:grid-cols-[280px_1fr_360px]">
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

        <div className="flex min-h-[520px] flex-col rounded-2xl border border-white/10 bg-black/5 p-4">
          <div className="flex-1">
            <DesignCanvas
              productImageUrl={productImageUrl}
              designArea={designArea}
              initialLayers={initialLayers}
              onLayerChange={setLayers}
              onSelectionChange={setSelectedLayer}
              onCanvasReady={setCanvas}
              readOnly={readOnly}
              className="h-full"
            />
          </div>
          {!editorReady && (
            <p className="mt-3 text-[11px] text-white/50">Canvas is initializing…</p>
          )}
        </div>

        {secondaryPanel}
      </div>

      <DesignLibrary
        open={libraryOpen}
        onOpenChange={(openState) => {
          setLibraryOpen(openState);
          if (!openState && activeTool === "library") {
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
        onSelectTemplate={(template) => loadTemplate(template.id)}
      />
    </div>
  );
}
