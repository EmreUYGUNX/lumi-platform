"use client";

import { useEffect, useMemo, useState } from "react";

import { Eye, EyeOff, LayoutGrid } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { uiStore } from "@/store";

import type { DesignAreaDTO } from "../../types/product-customization.types";
import { DesignAreaConfig } from "./DesignAreaConfig";
import { DesignAreaDrawer } from "./DesignAreaDrawer";

export interface ProductTemplateEditorProps {
  productImageUrl: string;
  imageWidth?: number | null;
  imageHeight?: number | null;
  areas: DesignAreaDTO[];
  onAreasChange: (areas: DesignAreaDTO[]) => void;
  className?: string;
}

export function ProductTemplateEditor({
  productImageUrl,
  imageWidth,
  imageHeight,
  areas,
  onAreasChange,
  className,
}: ProductTemplateEditorProps): JSX.Element {
  const [selectedAreaName, setSelectedAreaName] = useState<string | undefined>(areas[0]?.name);
  const [previewMode, setPreviewMode] = useState(false);

  const selectedArea = useMemo(
    () => areas.find((area) => area.name === selectedAreaName),
    [areas, selectedAreaName],
  );

  useEffect(() => {
    if (areas.length === 0) {
      setSelectedAreaName(undefined);
      return;
    }

    if (selectedAreaName && areas.some((area) => area.name === selectedAreaName)) {
      return;
    }

    setSelectedAreaName(areas[0]?.name);
  }, [areas, selectedAreaName]);

  const handleSaveArea = (next: DesignAreaDTO) => {
    const normalizedName = next.name.trim();
    const conflicts = areas.some(
      (area) => area.name !== selectedAreaName && area.name.trim() === normalizedName,
    );

    if (conflicts) {
      uiStore.getState().enqueueToast({
        variant: "error",
        title: "Duplicate area name",
        description: "Design area names must be unique.",
      });
      return;
    }

    const updated = areas.map((area) => (area.name === selectedAreaName ? next : area));
    onAreasChange(updated);
    setSelectedAreaName(next.name);
  };

  const handleDeleteArea = () => {
    if (!selectedAreaName) {
      return;
    }

    const updated = areas.filter((area) => area.name !== selectedAreaName);
    onAreasChange(updated);
    setSelectedAreaName(updated[0]?.name);
  };

  return (
    <div className={cn("space-y-6", className)}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <p className="text-sm font-semibold">Product template editor</p>
          <p className="text-lumi-text-secondary text-xs">
            Define one or more design areas that customers can personalize.
          </p>
        </div>

        <div className="flex items-center gap-3 rounded-full border border-black/10 bg-white/70 px-4 py-2 shadow-sm">
          <span className="text-lumi-text-secondary flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.26em]">
            {previewMode ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            Preview mode
          </span>
          <Switch checked={previewMode} onCheckedChange={setPreviewMode} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
        <DesignAreaDrawer
          productImage={productImageUrl}
          existingAreas={areas}
          onAreasChange={onAreasChange}
          selectedAreaName={selectedAreaName}
          onSelectedAreaNameChange={setSelectedAreaName}
          previewMode={previewMode}
          imageWidth={imageWidth}
          imageHeight={imageHeight}
        />

        <div className="space-y-6">
          <Card className="border-lumi-border/70">
            <CardHeader className="flex flex-row items-center justify-between gap-3">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <LayoutGrid className="text-lumi-primary h-4 w-4" />
                Areas ({areas.length})
              </CardTitle>
              <span className="text-lumi-text-secondary text-[10px] font-semibold uppercase tracking-[0.26em]">
                Select to edit
              </span>
            </CardHeader>
            <CardContent className="space-y-2">
              {areas.length === 0 ? (
                <p className="text-lumi-text-secondary text-sm">No areas created yet.</p>
              ) : (
                <div className="space-y-2">
                  {areas.map((area) => (
                    <button
                      key={area.name}
                      type="button"
                      className={cn(
                        "border-lumi-border/60 w-full rounded-xl border px-3 py-2 text-left text-sm font-semibold transition",
                        area.name === selectedAreaName
                          ? "bg-lumi-primary/10 border-lumi-primary/40"
                          : "hover:bg-lumi-bg-secondary/40",
                      )}
                      onClick={() => setSelectedAreaName(area.name)}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span>{area.name}</span>
                        <span className="text-lumi-text-secondary text-[10px] font-semibold uppercase tracking-[0.22em]">
                          {Math.round(area.width)}×{Math.round(area.height)}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {selectedArea ? (
            <DesignAreaConfig
              area={selectedArea}
              onSave={handleSaveArea}
              onDelete={handleDeleteArea}
            />
          ) : (
            <Card className="border-lumi-border/70">
              <CardContent className="space-y-2 p-6">
                <p className="text-sm font-semibold">Select an area to configure</p>
                <p className="text-lumi-text-secondary text-sm">
                  Click on a rectangle or pick a design area from the list.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
