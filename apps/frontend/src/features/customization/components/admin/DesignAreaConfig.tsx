"use client";

import { useEffect, useState } from "react";

import { AlertTriangle, Save, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

import type { DesignAreaDTO } from "../../types/product-customization.types";
import { designAreaSchema } from "../../types/product-customization.types";

interface DesignAreaConfigProps {
  area: DesignAreaDTO;
  onSave: (next: DesignAreaDTO) => void;
  onDelete?: () => void;
  className?: string;
}

const toNumber = (value: string, fallback: number) => {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
};

const toOptionalNumber = (value: string): number | undefined => {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  const next = Number(trimmed);
  return Number.isFinite(next) ? next : undefined;
};

export function DesignAreaConfig({
  area,
  onSave,
  onDelete,
  className,
}: DesignAreaConfigProps): JSX.Element {
  const [draft, setDraft] = useState<DesignAreaDTO>(area);
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    setDraft(area);
    setErrors([]);
  }, [area]);

  const aspectRatioEnabled = Boolean(draft.aspectRatio);

  const handleSave = () => {
    const parsed = designAreaSchema.safeParse(draft);
    if (!parsed.success) {
      setErrors(parsed.error.issues.map((issue) => issue.message));
      return;
    }

    setErrors([]);
    onSave(parsed.data);
  };

  return (
    <Card className={cn("border-lumi-border/70", className)}>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <CardTitle className="space-y-1">
          <span className="text-lumi-text-secondary block text-[10px] font-semibold uppercase tracking-[0.28em]">
            Area Configuration
          </span>
          <span className="text-lg font-semibold">{area.name}</span>
        </CardTitle>

        <div className="flex items-center gap-2">
          {onDelete && (
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="border-lumi-border/70 text-lumi-text-secondary h-10 w-10"
              onClick={onDelete}
              aria-label="Delete design area"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}

          <Button
            type="button"
            size="sm"
            className="h-10 gap-2 text-[11px] font-semibold uppercase tracking-[0.22em]"
            onClick={handleSave}
          >
            <Save className="h-4 w-4" />
            Save
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {errors.length > 0 && (
          <div className="border-lumi-border/70 bg-lumi-bg-secondary/40 space-y-1 rounded-xl border p-3 text-sm">
            <p className="flex items-center gap-2 font-semibold">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Validation issues
            </p>
            <ul className="text-lumi-text-secondary list-disc space-y-1 pl-5 text-xs">
              {errors.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="design-area-name">Area name</Label>
            <Input
              id="design-area-name"
              value={draft.name}
              onChange={(event) =>
                setDraft((current) => ({ ...current, name: event.target.value }))
              }
              placeholder="front"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="design-area-rotation">Rotation (°)</Label>
            <Input
              id="design-area-rotation"
              type="number"
              value={draft.rotation}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  rotation: toNumber(event.target.value, current.rotation),
                }))
              }
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="design-area-x">Position X (px)</Label>
            <Input
              id="design-area-x"
              type="number"
              value={draft.x}
              onChange={(event) =>
                setDraft((current) => ({ ...current, x: toNumber(event.target.value, current.x) }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="design-area-y">Position Y (px)</Label>
            <Input
              id="design-area-y"
              type="number"
              value={draft.y}
              onChange={(event) =>
                setDraft((current) => ({ ...current, y: toNumber(event.target.value, current.y) }))
              }
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="design-area-width">Width (px)</Label>
            <Input
              id="design-area-width"
              type="number"
              value={draft.width}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  width: toNumber(event.target.value, current.width),
                }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="design-area-height">Height (px)</Label>
            <Input
              id="design-area-height"
              type="number"
              value={draft.height}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  height: toNumber(event.target.value, current.height),
                }))
              }
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="design-area-min-size">Min design size (px)</Label>
            <Input
              id="design-area-min-size"
              type="number"
              value={draft.minDesignSize}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  minDesignSize: toNumber(event.target.value, current.minDesignSize),
                }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="design-area-max-size">Max design size (px)</Label>
            <Input
              id="design-area-max-size"
              type="number"
              value={draft.maxDesignSize}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  maxDesignSize: toNumber(event.target.value, current.maxDesignSize),
                }))
              }
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="design-area-aspect-ratio">Aspect ratio (W/H)</Label>
            <Input
              id="design-area-aspect-ratio"
              type="number"
              step="0.01"
              value={draft.aspectRatio ?? ""}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  aspectRatio: toOptionalNumber(event.target.value),
                }))
              }
              placeholder="Optional"
              disabled={!aspectRatioEnabled}
            />
          </div>

          <div className="flex items-end justify-between rounded-xl border border-dashed border-black/10 p-3">
            <div className="space-y-1">
              <p className="text-sm font-semibold">Enforce aspect ratio</p>
              <p className="text-lumi-text-secondary text-xs">
                Keeps resize handles locked to the ratio.
              </p>
            </div>
            <Switch
              checked={aspectRatioEnabled}
              onCheckedChange={(checked) => {
                setDraft((current) => {
                  if (!checked) {
                    return { ...current, aspectRatio: undefined };
                  }
                  const ratio =
                    current.width > 0 && current.height > 0 ? current.width / current.height : 1;
                  return { ...current, aspectRatio: Number.isFinite(ratio) ? ratio : 1 };
                });
              }}
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="flex items-center justify-between rounded-xl border border-dashed border-black/10 p-3">
            <div className="space-y-1">
              <p className="text-sm font-semibold">Allow resize</p>
              <p className="text-lumi-text-secondary text-xs">Users may scale layers inside.</p>
            </div>
            <Switch
              checked={draft.allowResize}
              onCheckedChange={(checked) => {
                setDraft((current) => ({ ...current, allowResize: checked }));
              }}
            />
          </div>

          <div className="flex items-center justify-between rounded-xl border border-dashed border-black/10 p-3">
            <div className="space-y-1">
              <p className="text-sm font-semibold">Allow rotation</p>
              <p className="text-lumi-text-secondary text-xs">Users may rotate layers inside.</p>
            </div>
            <Switch
              checked={draft.allowRotation}
              onCheckedChange={(checked) => {
                setDraft((current) => ({ ...current, allowRotation: checked }));
              }}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
