"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import * as fabric from "fabric";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Eye,
  EyeOff,
  FlipHorizontal,
  FlipVertical,
  Lock,
  LockOpen,
  Pipette,
  RotateCcw,
  RotateCw,
  SlidersHorizontal,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

import {
  DEFAULT_FONT,
  FONT_FAMILIES,
  FONT_WEIGHTS,
  ensureGoogleFontsStylesheet,
} from "../../utils/text-fonts";

type PropertiesPanelMode = "none" | "image" | "text" | "shape" | "other";

const SECTION_CARD_CLASS = "rounded-xl border border-white/10 bg-black/10 p-3";

const clampNumber = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

const clampLayerName = (value: string) => value.trim().slice(0, 32);

const round = (value: number, precision = 0): number => {
  if (!Number.isFinite(value)) return 0;
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
};

const readString = (value: unknown, fallback: string): string =>
  typeof value === "string" && value.trim() ? value : fallback;

const readBoolean = (value: unknown, fallback: boolean): boolean =>
  typeof value === "boolean" ? value : fallback;

const readNumber = (value: unknown, fallback: number): number =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

interface BaseObjectSnapshot {
  layerName: string;
  locked: boolean;
  hidden: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
  flipX: boolean;
  flipY: boolean;
}

const readBaseObjectSnapshot = (object: fabric.Object): BaseObjectSnapshot => {
  const raw = object as unknown as Record<string, unknown>;
  const flipState = object as unknown as { flipX?: unknown; flipY?: unknown };

  return {
    layerName: readString(raw.layerName, ""),
    locked: readBoolean(raw.isLocked, false),
    hidden: readBoolean(raw.isHidden, false),
    x: round(readNumber(object.left, 0)),
    y: round(readNumber(object.top, 0)),
    width: round(object.getScaledWidth()),
    height: round(object.getScaledHeight()),
    rotation: round(readNumber(object.angle, 0)),
    opacity: clampNumber(round(readNumber(object.opacity, 1) * 100), 0, 100),
    flipX: readBoolean(flipState.flipX, false),
    flipY: readBoolean(flipState.flipY, false),
  };
};

interface ShapeObjectSnapshot {
  fill: string;
  stroke: string;
}

const readShapeObjectSnapshot = (object: fabric.Object): ShapeObjectSnapshot => {
  const candidate = object as unknown as { fill?: unknown; stroke?: unknown };
  return {
    fill: readString(candidate.fill, "#111827"),
    stroke: readString(candidate.stroke, "#111827"),
  };
};

const resolveMode = (object: fabric.Object | undefined): PropertiesPanelMode => {
  if (!object) return "none";
  if (object.type === "activeSelection") return "none";

  const raw = object as unknown as Record<string, unknown>;
  const layerType = typeof raw.layerType === "string" ? raw.layerType : undefined;

  if (layerType === "text") return "text";
  if (layerType === "image" || layerType === "clipart") return "image";
  if (layerType === "shape") return "shape";

  if (typeof object.type === "string" && object.type.includes("text")) return "text";
  if (typeof object.type === "string" && object.type.includes("image")) return "image";

  return "other";
};

interface EyeDropperResult {
  sRGBHex: string;
}

type EyeDropperConstructor = new () => { open: () => Promise<EyeDropperResult> };

const getEyeDropper = (): EyeDropperConstructor | undefined => {
  if (typeof window === "undefined") return undefined;
  const candidate = (window as unknown as { EyeDropper?: unknown }).EyeDropper;
  return typeof candidate === "function" ? (candidate as EyeDropperConstructor) : undefined;
};

const RECENT_COLORS_STORAGE_KEY = "lumi.editor.recent-colors";
const MAX_RECENT_COLORS = 8;

const readRecentColors = (): string[] => {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RECENT_COLORS_STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : undefined;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((value): value is string => typeof value === "string");
  } catch {
    return [];
  }
};

const writeRecentColors = (colors: string[]): void => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(RECENT_COLORS_STORAGE_KEY, JSON.stringify(colors));
  } catch {
    // ignore storage failures
  }
};

const rememberColor = (color: string, recent: string[]): string[] => {
  const normalized = color.trim();
  if (!normalized) return recent;
  return [normalized, ...recent.filter((entry) => entry !== normalized)].slice(
    0,
    MAX_RECENT_COLORS,
  );
};

type TextAlign = "left" | "center" | "right";

const normalizeTextAlign = (value: unknown): TextAlign =>
  value === "left" || value === "right" ? value : "center";

const isEditableText = (
  object: fabric.Object | undefined,
): object is fabric.Textbox | fabric.IText | fabric.Text => {
  if (!object) return false;
  return object.type === "textbox" || object.type === "i-text" || object.type === "text";
};

const normalizeFontWeight = (value: unknown): (typeof FONT_WEIGHTS)[number] => {
  const weight =
    typeof value === "number" || typeof value === "string" ? String(value).trim() : undefined;
  return weight && (FONT_WEIGHTS as readonly string[]).includes(weight)
    ? (weight as (typeof FONT_WEIGHTS)[number])
    : "600";
};

interface TextObjectSnapshot {
  fontFamily: string;
  fontSize: number;
  fontWeight: (typeof FONT_WEIGHTS)[number];
  textAlign: TextAlign;
  letterSpacing: number;
  lineHeight: number;
  fill: string;
  strokeEnabled: boolean;
  strokeWidth: number;
  stroke: string;
  shadowEnabled: boolean;
  shadowBlur: number;
  shadowOffsetX: number;
  shadowOffsetY: number;
  shadowColor: string;
  backgroundEnabled: boolean;
  backgroundColor: string;
  backgroundPadding: number;
}

const readTextObjectSnapshot = (
  object: fabric.Textbox | fabric.IText | fabric.Text,
): TextObjectSnapshot => {
  const shadowState = readShadowState(object.shadow as fabric.Shadow | undefined);
  const strokeWidth = clampNumber(round(readNumber(object.strokeWidth, 0)), 0, 24);

  const backgroundRaw = readString(object.backgroundColor, "");
  const backgroundEnabled = Boolean(backgroundRaw);

  return {
    fontFamily: readString(object.fontFamily, DEFAULT_FONT),
    fontSize: clampNumber(round(readNumber(object.fontSize, 48)), 8, 200),
    fontWeight: normalizeFontWeight(object.fontWeight),
    textAlign: normalizeTextAlign(object.textAlign),
    letterSpacing: clampNumber(round(readNumber(object.charSpacing, 0)), -200, 400),
    lineHeight: clampNumber(round(readNumber(object.lineHeight, 1.15), 2), 0.6, 3),
    fill: readString(object.fill, "#111827"),
    strokeEnabled: strokeWidth > 0,
    strokeWidth,
    stroke: readString(object.stroke, "#111827"),
    shadowEnabled: shadowState.blur > 0 || shadowState.offsetX !== 0 || shadowState.offsetY !== 0,
    shadowBlur: clampNumber(round(shadowState.blur), 0, 60),
    shadowOffsetX: clampNumber(round(shadowState.offsetX), -50, 50),
    shadowOffsetY: clampNumber(round(shadowState.offsetY), -50, 50),
    shadowColor: shadowState.color,
    backgroundEnabled,
    backgroundColor: backgroundRaw || "#ffffff",
    backgroundPadding: clampNumber(round(readNumber(object.padding, 0)), 0, 80),
  };
};

interface CanvasConstraints {
  allowResize?: boolean;
  allowRotation?: boolean;
}

const readCanvasConstraints = (canvas: fabric.Canvas | undefined): CanvasConstraints => {
  if (!canvas) return {};
  const raw = canvas as unknown as { lumiDesignConstraints?: unknown };
  if (!raw.lumiDesignConstraints || typeof raw.lumiDesignConstraints !== "object") {
    return {};
  }
  return raw.lumiDesignConstraints as CanvasConstraints;
};

function readShadowState(shadow: fabric.Shadow | undefined) {
  const blur =
    shadow && typeof shadow.blur === "number" && Number.isFinite(shadow.blur) ? shadow.blur : 0;
  const offsetX =
    shadow && typeof shadow.offsetX === "number" && Number.isFinite(shadow.offsetX)
      ? shadow.offsetX
      : 0;
  const offsetY =
    shadow && typeof shadow.offsetY === "number" && Number.isFinite(shadow.offsetY)
      ? shadow.offsetY
      : 0;
  const color = shadow && typeof shadow.color === "string" ? shadow.color : "#000000";

  return { blur, offsetX, offsetY, color };
}

interface ImageFiltersState {
  brightness: number;
  contrast: number;
  saturation: number;
  blur: number;
  grayscale: boolean;
  sepia: boolean;
  invert: boolean;
}

const IMAGE_ADJUSTMENTS = [
  { label: "Brightness", key: "brightness", min: -100, max: 100 },
  { label: "Contrast", key: "contrast", min: -100, max: 100 },
  { label: "Saturation", key: "saturation", min: -100, max: 100 },
] as const;

const IMAGE_FILTER_TOGGLES = [
  { label: "Grayscale", key: "grayscale" },
  { label: "Sepia", key: "sepia" },
  { label: "Invert", key: "invert" },
] as const;

const FILTER_TYPES = new Set([
  "Brightness",
  "Contrast",
  "Saturation",
  "Blur",
  "Grayscale",
  "Sepia",
  "Invert",
]);

const readImageFilters = (image: fabric.Image): ImageFiltersState => {
  const filters = (image.filters ?? []).filter(Boolean) as unknown as Record<string, unknown>[];

  const findByType = (type: string) =>
    filters.find((filter) => typeof filter.type === "string" && filter.type === type);

  const brightness = findByType("Brightness");
  const contrast = findByType("Contrast");
  const saturation = findByType("Saturation");
  const blur = findByType("Blur");

  const grayscale = Boolean(findByType("Grayscale"));
  const sepia = Boolean(findByType("Sepia"));

  const invertFilter = findByType("Invert");
  const invert =
    typeof invertFilter?.invert === "boolean" ? invertFilter.invert : invertFilter !== undefined;

  return {
    brightness: clampNumber(round(Number(brightness?.brightness ?? 0) * 100), -100, 100),
    contrast: clampNumber(round(Number(contrast?.contrast ?? 0) * 100), -100, 100),
    saturation: clampNumber(round(Number(saturation?.saturation ?? 0) * 100), -100, 100),
    blur: clampNumber(round(Number(blur?.blur ?? 0) * 100), 0, 20),
    grayscale,
    sepia,
    invert,
  };
};

const buildManagedFilters = (
  state: ImageFiltersState,
): fabric.filters.BaseFilter<string, Record<string, unknown>>[] => {
  const next: fabric.filters.BaseFilter<string, Record<string, unknown>>[] = [];

  if (state.brightness !== 0) {
    next.push(
      new fabric.filters.Brightness({ brightness: clampNumber(state.brightness / 100, -1, 1) }),
    );
  }
  if (state.contrast !== 0) {
    next.push(new fabric.filters.Contrast({ contrast: clampNumber(state.contrast / 100, -1, 1) }));
  }
  if (state.saturation !== 0) {
    next.push(
      new fabric.filters.Saturation({ saturation: clampNumber(state.saturation / 100, -1, 1) }),
    );
  }
  if (state.blur !== 0) {
    next.push(new fabric.filters.Blur({ blur: clampNumber(state.blur / 100, 0, 1) }));
  }
  if (state.grayscale) {
    next.push(new fabric.filters.Grayscale());
  }
  if (state.sepia) {
    next.push(new fabric.filters.Sepia());
  }
  if (state.invert) {
    next.push(new fabric.filters.Invert({ invert: true, alpha: false }));
  }

  return next;
};

const applyImageFilters = (image: fabric.Image, nextState: ImageFiltersState): void => {
  const existing = (image.filters ?? []).filter(Boolean) as unknown as Record<string, unknown>[];
  const preserved = existing.filter((filter) => !FILTER_TYPES.has(String(filter.type)));
  const nextFilters = [
    ...(preserved as unknown as fabric.filters.BaseFilter<string, Record<string, unknown>>[]),
    ...buildManagedFilters(nextState),
  ];
  (image as unknown as { set: (props: Record<string, unknown>) => void }).set({
    filters: nextFilters,
  });
  image.applyFilters();
};

interface PropertiesPanelProps {
  canvas?: fabric.Canvas;
  readOnly?: boolean;
  className?: string;
}

interface ShapePropertiesSectionProps {
  visible: boolean;
  canEdit: boolean;
  fill: string;
  stroke: string;
  onFillChange: (value: string) => void;
  onStrokeChange: (value: string) => void;
}

function ShapePropertiesSection({
  visible,
  canEdit,
  fill,
  stroke,
  onFillChange,
  onStrokeChange,
}: ShapePropertiesSectionProps): JSX.Element | undefined {
  if (!visible) return undefined;

  return (
    <div className={SECTION_CARD_CLASS}>
      <h4 className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/60">Shape</h4>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <div className="grid gap-2">
          <Label className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/60">
            Fill
          </Label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={fill}
              disabled={!canEdit}
              onChange={(event) => onFillChange(event.target.value)}
              className="h-10 w-12 cursor-pointer rounded-xl border border-white/10 bg-black/10 p-1"
              aria-label="Fill color picker"
            />
            <Input
              value={fill}
              disabled={!canEdit}
              onChange={(event) => onFillChange(event.target.value)}
              className="h-10 flex-1 rounded-xl border-white/10 bg-black/10 text-[11px] text-white"
            />
          </div>
        </div>
        <div className="grid gap-2">
          <Label className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/60">
            Stroke
          </Label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={stroke}
              disabled={!canEdit}
              onChange={(event) => onStrokeChange(event.target.value)}
              className="h-10 w-12 cursor-pointer rounded-xl border border-white/10 bg-black/10 p-1"
              aria-label="Stroke color picker"
            />
            <Input
              value={stroke}
              disabled={!canEdit}
              onChange={(event) => onStrokeChange(event.target.value)}
              className="h-10 flex-1 rounded-xl border-white/10 bg-black/10 text-[11px] text-white"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

interface ImagePropertiesSectionProps {
  visible: boolean;
  canEdit: boolean;
  filters: ImageFiltersState;
  onFiltersChange: (next: ImageFiltersState) => void;
}

function ImagePropertiesSection({
  visible,
  canEdit,
  filters,
  onFiltersChange,
}: ImagePropertiesSectionProps): JSX.Element | undefined {
  if (!visible) return undefined;

  return (
    <div className={SECTION_CARD_CLASS}>
      <h4 className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/60">Image</h4>
      <div className="mt-3 space-y-3">
        {IMAGE_ADJUSTMENTS.map((adjustment) => (
          <div key={adjustment.key} className="grid gap-2">
            <Label className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/60">
              {adjustment.label} ({filters[adjustment.key]})
            </Label>
            <input
              type="range"
              min={adjustment.min}
              max={adjustment.max}
              value={filters[adjustment.key]}
              disabled={!canEdit}
              onChange={(event) => {
                const nextValue = clampNumber(
                  Number(event.target.value),
                  adjustment.min,
                  adjustment.max,
                );
                onFiltersChange({ ...filters, [adjustment.key]: nextValue });
              }}
              className="accent-white"
            />
          </div>
        ))}

        <div className="grid gap-2">
          <Label className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/60">
            Blur ({filters.blur})
          </Label>
          <input
            type="range"
            min={0}
            max={20}
            value={filters.blur}
            disabled={!canEdit}
            onChange={(event) => {
              const nextValue = clampNumber(Number(event.target.value), 0, 20);
              onFiltersChange({ ...filters, blur: nextValue });
            }}
            className="accent-white"
          />
        </div>

        <div className="grid grid-cols-3 gap-3">
          {IMAGE_FILTER_TOGGLES.map((toggle) => (
            <div
              key={toggle.key}
              className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-black/10 px-3 py-2"
            >
              <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/60">
                {toggle.label}
              </span>
              <Switch
                checked={filters[toggle.key]}
                disabled={!canEdit}
                onCheckedChange={(nextChecked) => {
                  onFiltersChange({ ...filters, [toggle.key]: nextChecked });
                }}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

interface LayerVisibilityToggleButtonProps {
  hidden: boolean;
  disabled: boolean;
  onChange: (nextHidden: boolean) => void;
}

function LayerVisibilityToggleButton({
  hidden,
  disabled,
  onChange,
}: LayerVisibilityToggleButtonProps): JSX.Element {
  return (
    <Button
      type="button"
      size="icon"
      variant="ghost"
      className="h-9 w-9 rounded-lg"
      aria-label={hidden ? "Show layer" : "Hide layer"}
      disabled={disabled}
      onClick={() => onChange(!hidden)}
    >
      {hidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
    </Button>
  );
}

interface LayerLockToggleButtonProps {
  locked: boolean;
  disabled: boolean;
  onChange: (nextLocked: boolean) => void;
}

function LayerLockToggleButton({
  locked,
  disabled,
  onChange,
}: LayerLockToggleButtonProps): JSX.Element {
  return (
    <Button
      type="button"
      size="icon"
      variant="ghost"
      className="h-9 w-9 rounded-lg"
      aria-label={locked ? "Unlock layer" : "Lock layer"}
      disabled={disabled}
      onClick={() => onChange(!locked)}
    >
      {locked ? <Lock className="h-4 w-4" /> : <LockOpen className="h-4 w-4" />}
    </Button>
  );
}

export function PropertiesPanel({
  canvas,
  readOnly = false,
  className,
}: PropertiesPanelProps): JSX.Element {
  const [mode, setMode] = useState<PropertiesPanelMode>("none");
  const [resizeAllowed, setResizeAllowed] = useState(true);
  const [rotationAllowed, setRotationAllowed] = useState(true);
  const [layerName, setLayerName] = useState("");
  const [locked, setLocked] = useState(false);
  const [hidden, setHidden] = useState(false);

  const [x, setX] = useState(0);
  const [y, setY] = useState(0);
  const [width, setWidth] = useState(0);
  const [height, setHeight] = useState(0);
  const [rotation, setRotation] = useState(0);
  const [opacity, setOpacity] = useState(100);

  const [aspectLocked, setAspectLocked] = useState(true);

  const [flipX, setFlipX] = useState(false);
  const [flipY, setFlipY] = useState(false);

  const [recentColors, setRecentColors] = useState<string[]>(() => readRecentColors());

  const [imageFilters, setImageFilters] = useState<ImageFiltersState>(() => ({
    brightness: 0,
    contrast: 0,
    saturation: 0,
    blur: 0,
    grayscale: false,
    sepia: false,
    invert: false,
  }));

  const [fontFamily, setFontFamily] = useState(DEFAULT_FONT);
  const [fontSize, setFontSize] = useState(48);
  const [fontWeight, setFontWeight] = useState<(typeof FONT_WEIGHTS)[number]>("600");
  const [textAlign, setTextAlign] = useState<TextAlign>("center");
  const [letterSpacing, setLetterSpacing] = useState(0);
  const [lineHeight, setLineHeight] = useState(1.15);

  const [fill, setFill] = useState("#111827");

  const [strokeEnabled, setStrokeEnabled] = useState(false);
  const [strokeWidth, setStrokeWidth] = useState(0);
  const [stroke, setStroke] = useState("#111827");

  const [shadowEnabled, setShadowEnabled] = useState(false);
  const [shadowBlur, setShadowBlur] = useState(0);
  const [shadowOffsetX, setShadowOffsetX] = useState(0);
  const [shadowOffsetY, setShadowOffsetY] = useState(0);
  const [shadowColor, setShadowColor] = useState("#000000");

  const [backgroundEnabled, setBackgroundEnabled] = useState(false);
  const [backgroundColor, setBackgroundColor] = useState("#ffffff");
  const [backgroundPadding, setBackgroundPadding] = useState(0);

  const filterRaf = useRef<number | undefined>();
  const filterPending = useRef<ImageFiltersState | undefined>();
  const filterTarget = useRef<fabric.Image | undefined>();

  const resolveActiveObject = useCallback((): fabric.Object | undefined => {
    const active = canvas?.getActiveObject();
    if (!active || active.type === "activeSelection") return undefined;
    return active;
  }, [canvas]);

  const commitRecentColor = useCallback(
    (color: string) => {
      setRecentColors((previous) => {
        const next = rememberColor(color, previous);
        writeRecentColors(next);
        return next;
      });
    },
    [setRecentColors],
  );

  const syncFromCanvas = useCallback(() => {
    const constraints = readCanvasConstraints(canvas);
    setResizeAllowed(constraints.allowResize ?? true);
    setRotationAllowed(constraints.allowRotation ?? true);

    const active = resolveActiveObject();
    const nextMode = resolveMode(active);
    setMode(nextMode);

    if (!active) {
      setLayerName("");
      setLocked(false);
      setHidden(false);
      return;
    }

    const base = readBaseObjectSnapshot(active);
    setLayerName(base.layerName);
    setLocked(base.locked);
    setHidden(base.hidden);
    setX(base.x);
    setY(base.y);
    setWidth(base.width);
    setHeight(base.height);
    setRotation(base.rotation);
    setOpacity(base.opacity);
    setFlipX(base.flipX);
    setFlipY(base.flipY);

    if (nextMode === "image" && active.type === "image") {
      setImageFilters(readImageFilters(active as unknown as fabric.Image));
      return;
    }

    if (nextMode === "shape") {
      const shape = readShapeObjectSnapshot(active);
      setFill(shape.fill);
      setStroke(shape.stroke);
      return;
    }

    if (nextMode !== "text" || !isEditableText(active)) {
      return;
    }

    const text = readTextObjectSnapshot(active);
    setFontFamily(text.fontFamily);
    setFontSize(text.fontSize);
    setFontWeight(text.fontWeight);
    setTextAlign(text.textAlign);
    setLetterSpacing(text.letterSpacing);
    setLineHeight(text.lineHeight);
    setFill(text.fill);

    setStrokeEnabled(text.strokeEnabled);
    setStrokeWidth(text.strokeWidth);
    setStroke(text.stroke);

    setShadowEnabled(text.shadowEnabled);
    setShadowBlur(text.shadowBlur);
    setShadowOffsetX(text.shadowOffsetX);
    setShadowOffsetY(text.shadowOffsetY);
    setShadowColor(text.shadowColor);

    setBackgroundEnabled(text.backgroundEnabled);
    setBackgroundColor(text.backgroundColor);
    setBackgroundPadding(text.backgroundPadding);
  }, [canvas, resolveActiveObject]);

  useEffect(() => {
    ensureGoogleFontsStylesheet();
  }, []);

  useEffect(() => {
    syncFromCanvas();
  }, [syncFromCanvas]);

  useEffect(() => {
    if (!canvas) return () => {};

    const handle = () => syncFromCanvas();
    canvas.on("selection:created", handle);
    canvas.on("selection:updated", handle);
    canvas.on("selection:cleared", handle);
    canvas.on("object:modified", handle);
    canvas.on("text:changed", handle);

    return () => {
      canvas.off("selection:created", handle);
      canvas.off("selection:updated", handle);
      canvas.off("selection:cleared", handle);
      canvas.off("object:modified", handle);
      canvas.off("text:changed", handle);
    };
  }, [canvas, syncFromCanvas]);

  useEffect(() => {
    return () => {
      if (filterRaf.current !== undefined) {
        window.cancelAnimationFrame(filterRaf.current);
        filterRaf.current = undefined;
      }
      filterPending.current = undefined;
      filterTarget.current = undefined;
    };
  }, []);

  const applyMutation = useCallback(
    (
      mutate: (object: fabric.Object) => void,
      options: Partial<{ discardSelection: boolean }> = {},
    ) => {
      if (!canvas) return;
      const target = resolveActiveObject();
      if (!target) return;

      mutate(target);

      target.setCoords();
      canvas.requestRenderAll();
      canvas.fire("object:modified", { target });

      if (options.discardSelection) {
        canvas.discardActiveObject();
        canvas.requestRenderAll();
      }
    },
    [canvas, resolveActiveObject],
  );

  const canToggle = !readOnly;
  const canEdit = !readOnly && !locked;
  const canResize = canEdit && resizeAllowed;
  const canRotate = canEdit && rotationAllowed;

  const eyeDropperAvailable = useMemo(() => Boolean(getEyeDropper()), []);

  const handleShapeFillChange = useCallback(
    (next: string) => {
      setFill(next);
      applyMutation((object) => object.set({ fill: next }));
    },
    [applyMutation],
  );

  const handleShapeStrokeChange = useCallback(
    (next: string) => {
      setStroke(next);
      applyMutation((object) => object.set({ stroke: next }));
    },
    [applyMutation],
  );

  const applyLayerName = useCallback(
    (nextValue: string) => {
      const next = clampLayerName(nextValue);
      applyMutation((object) => {
        const raw = object as unknown as Record<string, unknown>;
        raw.layerName = next;
      });
    },
    [applyMutation],
  );

  const applyVisibility = useCallback(
    (nextHidden: boolean) => {
      applyMutation((object) => {
        const raw = object as unknown as Record<string, unknown>;
        raw.isHidden = nextHidden;
        object.set({ visible: !nextHidden });
      });
    },
    [applyMutation],
  );

  const applyLock = useCallback(
    (nextLocked: boolean) => {
      applyMutation(
        (object) => {
          const raw = object as unknown as Record<string, unknown>;
          raw.isLocked = nextLocked;
          object.set({ selectable: !nextLocked, evented: !nextLocked });
        },
        { discardSelection: nextLocked },
      );
    },
    [applyMutation],
  );

  const applyPosition = useCallback(
    (nextX: number, nextY: number) => {
      applyMutation((object) => {
        object.set({ left: nextX, top: nextY });
      });
    },
    [applyMutation],
  );

  const applyRotation = useCallback(
    (nextAngle: number) => {
      applyMutation((object) => {
        object.set({ angle: nextAngle });
      });
    },
    [applyMutation],
  );

  const applyOpacity = useCallback(
    (nextOpacity: number) => {
      applyMutation((object) => {
        object.set({ opacity: clampNumber(nextOpacity / 100, 0, 1) });
      });
    },
    [applyMutation],
  );

  const applySize = useCallback(
    (nextWidth: number, nextHeight: number, keepAspect: boolean) => {
      applyMutation((object) => {
        const currentWidth = object.getScaledWidth();
        const currentHeight = object.getScaledHeight();
        const safeCurrentWidth = currentWidth > 0 ? currentWidth : 1;
        const safeCurrentHeight = currentHeight > 0 ? currentHeight : 1;

        const resolvedWidth = Math.max(1, nextWidth);
        const resolvedHeight = Math.max(1, nextHeight);

        if (keepAspect) {
          const factor = resolvedWidth / safeCurrentWidth;
          const scaleX = (object.scaleX ?? 1) * factor;
          const scaleY = (object.scaleY ?? 1) * factor;
          object.set({ scaleX, scaleY });
          return;
        }

        const factorX = resolvedWidth / safeCurrentWidth;
        const factorY = resolvedHeight / safeCurrentHeight;
        object.set({
          scaleX: (object.scaleX ?? 1) * factorX,
          scaleY: (object.scaleY ?? 1) * factorY,
        });
      });
    },
    [applyMutation],
  );

  const applyFlip = useCallback(
    (axis: "x" | "y", enabled: boolean) => {
      applyMutation((object) => {
        object.set(axis === "x" ? { flipX: enabled } : { flipY: enabled });
      });
    },
    [applyMutation],
  );

  const applyRotationPreset = useCallback(
    (delta: number) => {
      applyMutation((object) => {
        const current = typeof object.angle === "number" ? object.angle : 0;
        object.set({ angle: clampNumber(current + delta, -180, 180) });
      });
    },
    [applyMutation],
  );

  const resetTransforms = useCallback(() => {
    applyMutation((object) => {
      object.set({
        angle: 0,
        scaleX: 1,
        scaleY: 1,
        flipX: false,
        flipY: false,
        skewX: 0,
        skewY: 0,
      });
    });
  }, [applyMutation]);

  const scheduleFilterApply = useCallback(
    (nextState: ImageFiltersState) => {
      if (!canvas) return;
      const target = resolveActiveObject();
      if (!target || target.type !== "image") return;

      filterPending.current = nextState;
      filterTarget.current = target as unknown as fabric.Image;
      if (filterRaf.current !== undefined) return;

      filterRaf.current = window.requestAnimationFrame(() => {
        filterRaf.current = undefined;
        const pending = filterPending.current;
        filterPending.current = undefined;
        if (!pending) return;

        const image = filterTarget.current;
        if (!image) return;
        applyImageFilters(image, pending);
        image.setCoords();
        canvas.requestRenderAll();
        canvas.fire("object:modified", { target: image });
      });
    },
    [canvas, resolveActiveObject],
  );

  const handleImageFiltersChange = useCallback(
    (next: ImageFiltersState) => {
      setImageFilters(next);
      scheduleFilterApply(next);
    },
    [scheduleFilterApply],
  );

  const applyTextPatch = useCallback(
    (patch: Partial<fabric.ITextProps>) => {
      if (!canEdit) return;
      applyMutation((object) => {
        if (!isEditableText(object)) return;
        object.set(patch);
      });
    },
    [applyMutation, canEdit],
  );

  const applyShadow = useCallback(
    (next: { enabled: boolean; blur: number; offsetX: number; offsetY: number; color: string }) => {
      if (!canEdit) return;
      applyMutation((object) => {
        if (!isEditableText(object)) return;

        if (!next.enabled) {
          object.set({ shadow: undefined });
          return;
        }

        object.set({
          shadow: new fabric.Shadow({
            blur: next.blur,
            offsetX: next.offsetX,
            offsetY: next.offsetY,
            color: next.color,
          }),
        });
      });
    },
    [applyMutation, canEdit],
  );

  const applyBackground = useCallback(
    (next: { enabled: boolean; color: string; padding: number }) => {
      if (!canEdit) return;
      applyMutation((object) => {
        if (!isEditableText(object)) return;

        if (!next.enabled) {
          object.set({ backgroundColor: undefined, padding: 0 });
          return;
        }

        object.set({
          backgroundColor: next.color,
          padding: next.padding,
        });
      });
    },
    [applyMutation, canEdit],
  );

  const pickColor = useCallback(async () => {
    if (!canEdit) return;
    const Constructor = getEyeDropper();
    if (!Constructor) return;
    try {
      const result = await new Constructor().open();
      setFill(result.sRGBHex);
      commitRecentColor(result.sRGBHex);
      applyTextPatch({ fill: result.sRGBHex });
    } catch {
      // ignore cancellation or errors
    }
  }, [applyTextPatch, canEdit, commitRecentColor]);

  return (
    <section
      className={cn(
        "flex h-full flex-col gap-4 rounded-2xl border border-white/10 bg-black/5 p-4 text-white/80",
        className,
      )}
      aria-label="Properties panel"
    >
      <header className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-white/70" />
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.28em]">Properties</h3>
        </div>
      </header>

      <div className="flex-1 overflow-auto pr-1">
        {mode === "none" ? (
          <div className={cn(SECTION_CARD_CLASS, "text-[11px] text-white/60")}>
            Select a layer to edit its properties.
          </div>
        ) : (
          <div className="space-y-4">
            <div className={SECTION_CARD_CLASS}>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/60">
                    Layer
                  </p>
                  <p className="mt-1 truncate text-[11px] font-semibold uppercase tracking-[0.22em] text-white/80">
                    {mode.toUpperCase()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <LayerVisibilityToggleButton
                    hidden={hidden}
                    disabled={!canToggle}
                    onChange={(nextHidden) => {
                      setHidden(nextHidden);
                      applyVisibility(nextHidden);
                    }}
                  />
                  <LayerLockToggleButton
                    locked={locked}
                    disabled={!canToggle}
                    onChange={(nextLocked) => {
                      setLocked(nextLocked);
                      applyLock(nextLocked);
                    }}
                  />
                </div>
              </div>

              <div className="mt-3 grid gap-2">
                <Label className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/60">
                  Name
                </Label>
                <Input
                  value={layerName}
                  disabled={!canEdit}
                  aria-label="Layer name"
                  onChange={(event) => {
                    setLayerName(event.target.value);
                  }}
                  onBlur={() => {
                    applyLayerName(layerName);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      (event.target as HTMLInputElement).blur();
                    }
                  }}
                  className="h-10 rounded-xl border-white/10 bg-black/10 text-[11px] text-white"
                />
              </div>

              <div className="mt-3 grid grid-cols-2 gap-3">
                <div className="flex items-center justify-between rounded-xl border border-white/10 bg-black/10 px-3 py-2">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/60">
                    Visible
                  </span>
                  <Switch
                    checked={!hidden}
                    disabled={!canToggle}
                    onCheckedChange={(nextVisible) => {
                      const nextHidden = !nextVisible;
                      setHidden(nextHidden);
                      applyVisibility(nextHidden);
                    }}
                  />
                </div>
                <div className="flex items-center justify-between rounded-xl border border-white/10 bg-black/10 px-3 py-2">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/60">
                    Locked
                  </span>
                  <Switch
                    checked={locked}
                    disabled={!canToggle}
                    onCheckedChange={(nextLocked) => {
                      setLocked(nextLocked);
                      applyLock(nextLocked);
                    }}
                  />
                </div>
              </div>
            </div>

            <div className={SECTION_CARD_CLASS}>
              <h4 className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/60">
                Position
              </h4>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/60">
                    X
                  </Label>
                  <Input
                    type="number"
                    value={x}
                    disabled={!canEdit}
                    aria-label="X position"
                    onChange={(event) => {
                      const next = Number(event.target.value);
                      if (!Number.isFinite(next)) return;
                      setX(next);
                      applyPosition(next, y);
                    }}
                    className="h-10 rounded-xl border-white/10 bg-black/10 text-[11px] text-white"
                  />
                </div>
                <div className="grid gap-2">
                  <Label className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/60">
                    Y
                  </Label>
                  <Input
                    type="number"
                    value={y}
                    disabled={!canEdit}
                    aria-label="Y position"
                    onChange={(event) => {
                      const next = Number(event.target.value);
                      if (!Number.isFinite(next)) return;
                      setY(next);
                      applyPosition(x, next);
                    }}
                    className="h-10 rounded-xl border-white/10 bg-black/10 text-[11px] text-white"
                  />
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between gap-3">
                <h4 className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/60">
                  Size
                </h4>
                {mode === "image" && (
                  <button
                    type="button"
                    className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/60 hover:text-white"
                    disabled={!canResize}
                    onClick={() => setAspectLocked((prev) => !prev)}
                  >
                    {aspectLocked ? "Lock ratio" : "Free"}
                  </button>
                )}
              </div>

              <div className="mt-3 grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/60">
                    W
                  </Label>
                  <Input
                    type="number"
                    min={1}
                    value={width}
                    disabled={!canResize}
                    aria-label="Width"
                    onChange={(event) => {
                      const next = Number(event.target.value);
                      if (!Number.isFinite(next)) return;
                      setWidth(next);
                      applySize(next, height, mode === "image" ? aspectLocked : false);
                    }}
                    className="h-10 rounded-xl border-white/10 bg-black/10 text-[11px] text-white"
                  />
                </div>
                <div className="grid gap-2">
                  <Label className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/60">
                    H
                  </Label>
                  <Input
                    type="number"
                    min={1}
                    value={height}
                    disabled={!canResize || (mode === "image" && aspectLocked)}
                    aria-label="Height"
                    onChange={(event) => {
                      const next = Number(event.target.value);
                      if (!Number.isFinite(next)) return;
                      setHeight(next);
                      applySize(width, next, mode === "image" ? aspectLocked : false);
                    }}
                    className="h-10 rounded-xl border-white/10 bg-black/10 text-[11px] text-white"
                  />
                </div>
              </div>

              <div className="mt-4 grid gap-2">
                <Label className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/60">
                  Rotation ({rotation}°)
                </Label>
                <input
                  type="range"
                  min={-180}
                  max={180}
                  value={rotation}
                  disabled={!canRotate}
                  aria-label="Rotation"
                  onChange={(event) => {
                    const next = clampNumber(Number(event.target.value), -180, 180);
                    setRotation(next);
                    applyRotation(next);
                  }}
                  className="accent-white"
                />
              </div>

              <div className="mt-4 grid gap-2">
                <Label className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/60">
                  Opacity ({opacity}%)
                </Label>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={opacity}
                  disabled={!canEdit}
                  aria-label="Opacity"
                  onChange={(event) => {
                    const next = clampNumber(Number(event.target.value), 0, 100);
                    setOpacity(next);
                    applyOpacity(next);
                  }}
                  className="accent-white"
                />
              </div>
            </div>

            <div className={SECTION_CARD_CLASS}>
              <h4 className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/60">
                Transform
              </h4>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  className="h-9 justify-start gap-2 rounded-xl px-3 text-[11px] uppercase tracking-[0.18em]"
                  disabled={!canEdit}
                  onClick={() => {
                    const next = !flipX;
                    setFlipX(next);
                    applyFlip("x", next);
                  }}
                >
                  <FlipHorizontal className="h-4 w-4" />
                  Flip X
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  className="h-9 justify-start gap-2 rounded-xl px-3 text-[11px] uppercase tracking-[0.18em]"
                  disabled={!canEdit}
                  onClick={() => {
                    const next = !flipY;
                    setFlipY(next);
                    applyFlip("y", next);
                  }}
                >
                  <FlipVertical className="h-4 w-4" />
                  Flip Y
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  className="h-9 justify-start gap-2 rounded-xl px-3 text-[11px] uppercase tracking-[0.18em]"
                  disabled={!canRotate}
                  onClick={() => applyRotationPreset(90)}
                >
                  <RotateCw className="h-4 w-4" />
                  +90°
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  className="h-9 justify-start gap-2 rounded-xl px-3 text-[11px] uppercase tracking-[0.18em]"
                  disabled={!canRotate}
                  onClick={() => applyRotationPreset(-90)}
                >
                  <RotateCcw className="h-4 w-4" />
                  -90°
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  className="h-9 justify-start gap-2 rounded-xl px-3 text-[11px] uppercase tracking-[0.18em]"
                  disabled={!canRotate}
                  onClick={() => applyRotationPreset(180)}
                >
                  <RotateCw className="h-4 w-4" />
                  180°
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="h-9 justify-start gap-2 rounded-xl px-3 text-[11px] uppercase tracking-[0.18em]"
                  disabled={!canEdit}
                  onClick={resetTransforms}
                >
                  Reset
                </Button>
              </div>
            </div>

            <ImagePropertiesSection
              visible={mode === "image"}
              canEdit={canEdit}
              filters={imageFilters}
              onFiltersChange={handleImageFiltersChange}
            />

            <ShapePropertiesSection
              visible={mode === "shape"}
              canEdit={canEdit}
              fill={fill}
              stroke={stroke}
              onFillChange={handleShapeFillChange}
              onStrokeChange={handleShapeStrokeChange}
            />

            {mode === "text" && (
              <div className={SECTION_CARD_CLASS}>
                <h4 className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/60">
                  Text
                </h4>
                <div className="mt-3 space-y-4">
                  <div className="grid gap-2">
                    <Label className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/60">
                      Font
                    </Label>
                    <Select
                      value={fontFamily}
                      onValueChange={(value) => {
                        setFontFamily(value);
                        applyTextPatch({ fontFamily: value });
                      }}
                      disabled={!canEdit}
                    >
                      <SelectTrigger className="h-10 rounded-xl border-white/10 bg-black/10 text-[11px] text-white">
                        <SelectValue placeholder="Font" />
                      </SelectTrigger>
                      <SelectContent className="border-white/10 bg-black/90 text-white">
                        <SelectGroup>
                          <SelectLabel className="text-[10px] uppercase tracking-[0.22em] text-white/50">
                            Fonts
                          </SelectLabel>
                          {FONT_FAMILIES.map((font) => (
                            <SelectItem key={font} value={font}>
                              <span style={{ fontFamily: font }}>{font}</span>
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="grid gap-2">
                      <Label className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/60">
                        Size
                      </Label>
                      <Input
                        type="number"
                        min={8}
                        max={200}
                        value={fontSize}
                        disabled={!canEdit}
                        onChange={(event) => {
                          const next = clampNumber(Number(event.target.value), 8, 200);
                          setFontSize(next);
                          applyTextPatch({ fontSize: next });
                        }}
                        className="h-10 rounded-xl border-white/10 bg-black/10 text-[11px] text-white"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/60">
                        Weight
                      </Label>
                      <Select
                        value={fontWeight}
                        onValueChange={(value) => {
                          const next = (FONT_WEIGHTS as readonly string[]).includes(value)
                            ? (value as (typeof FONT_WEIGHTS)[number])
                            : "600";
                          setFontWeight(next);
                          applyTextPatch({ fontWeight: next });
                        }}
                        disabled={!canEdit}
                      >
                        <SelectTrigger className="h-10 rounded-xl border-white/10 bg-black/10 text-[11px] text-white">
                          <SelectValue placeholder="Weight" />
                        </SelectTrigger>
                        <SelectContent className="border-white/10 bg-black/90 text-white">
                          {FONT_WEIGHTS.map((weight) => (
                            <SelectItem key={weight} value={weight}>
                              {weight}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <Label className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/60">
                      Align
                    </Label>
                    <div className="grid grid-cols-3 gap-2">
                      {(
                        [
                          ["left", AlignLeft],
                          ["center", AlignCenter],
                          ["right", AlignRight],
                        ] as const
                      ).map(([value, Icon]) => (
                        <Button
                          key={value}
                          type="button"
                          variant={textAlign === value ? "secondary" : "ghost"}
                          className="h-9 rounded-xl"
                          disabled={!canEdit}
                          aria-label={`Align ${value}`}
                          onClick={() => {
                            setTextAlign(value);
                            applyTextPatch({ textAlign: value });
                          }}
                        >
                          <Icon className="h-4 w-4" />
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <Label className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/60">
                      Color
                    </Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={fill}
                        disabled={!canEdit}
                        onChange={(event) => {
                          const next = event.target.value;
                          setFill(next);
                          commitRecentColor(next);
                          applyTextPatch({ fill: next });
                        }}
                        className="h-10 w-12 cursor-pointer rounded-xl border border-white/10 bg-black/10 p-1"
                        aria-label="Text color picker"
                      />
                      <Input
                        value={fill}
                        disabled={!canEdit}
                        onChange={(event) => {
                          const next = event.target.value;
                          setFill(next);
                          applyTextPatch({ fill: next });
                        }}
                        onBlur={() => commitRecentColor(fill)}
                        className="h-10 flex-1 rounded-xl border-white/10 bg-black/10 text-[11px] text-white"
                      />
                      <Button
                        type="button"
                        size="icon"
                        variant="secondary"
                        className="h-10 w-10 rounded-xl"
                        disabled={!canEdit || !eyeDropperAvailable}
                        onClick={() => {
                          pickColor().catch(() => {});
                        }}
                        aria-label="Pick color"
                      >
                        <Pipette className="h-4 w-4" />
                      </Button>
                    </div>

                    {recentColors.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {recentColors.slice(0, MAX_RECENT_COLORS).map((color) => (
                          <button
                            key={color}
                            type="button"
                            className="h-8 w-8 rounded-xl border border-white/10"
                            style={{ backgroundColor: color }}
                            aria-label={`Apply color ${color}`}
                            disabled={!canEdit}
                            onClick={() => {
                              setFill(color);
                              applyTextPatch({ fill: color });
                            }}
                          />
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="grid gap-2">
                    <Label className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/60">
                      Letter spacing ({letterSpacing})
                    </Label>
                    <input
                      type="range"
                      min={-200}
                      max={400}
                      value={letterSpacing}
                      disabled={!canEdit}
                      onChange={(event) => {
                        const next = clampNumber(Number(event.target.value), -200, 400);
                        setLetterSpacing(next);
                        applyTextPatch({ charSpacing: next });
                      }}
                      className="accent-white"
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/60">
                      Line height ({lineHeight.toFixed(2)})
                    </Label>
                    <input
                      type="range"
                      min={0.6}
                      max={3}
                      step={0.05}
                      value={lineHeight}
                      disabled={!canEdit}
                      onChange={(event) => {
                        const next = clampNumber(Number(event.target.value), 0.6, 3);
                        setLineHeight(next);
                        applyTextPatch({ lineHeight: next });
                      }}
                      className="accent-white"
                    />
                  </div>

                  <div className="grid gap-3 rounded-xl border border-white/10 bg-black/10 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <h5 className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/60">
                        Stroke
                      </h5>
                      <Switch
                        checked={strokeEnabled}
                        disabled={!canEdit}
                        onCheckedChange={(enabled) => {
                          setStrokeEnabled(enabled);
                          const nextWidth = enabled ? Math.max(1, strokeWidth) : 0;
                          setStrokeWidth(nextWidth);
                          applyTextPatch({
                            strokeWidth: enabled ? nextWidth : 0,
                            stroke: enabled ? stroke : undefined,
                          });
                        }}
                      />
                    </div>

                    {strokeEnabled && (
                      <div className="space-y-3">
                        <div className="grid gap-2">
                          <Label className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/60">
                            Width ({strokeWidth}px)
                          </Label>
                          <input
                            type="range"
                            min={1}
                            max={24}
                            value={strokeWidth}
                            disabled={!canEdit}
                            onChange={(event) => {
                              const next = clampNumber(Number(event.target.value), 1, 24);
                              setStrokeWidth(next);
                              applyTextPatch({ strokeWidth: next, stroke });
                            }}
                            className="accent-white"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={stroke}
                            disabled={!canEdit}
                            onChange={(event) => {
                              const next = event.target.value;
                              setStroke(next);
                              applyTextPatch({ stroke: next, strokeWidth });
                            }}
                            className="h-10 w-12 cursor-pointer rounded-xl border border-white/10 bg-black/10 p-1"
                            aria-label="Stroke color picker"
                          />
                          <Input
                            value={stroke}
                            disabled={!canEdit}
                            onChange={(event) => {
                              const next = event.target.value;
                              setStroke(next);
                              applyTextPatch({ stroke: next, strokeWidth });
                            }}
                            className="h-10 flex-1 rounded-xl border-white/10 bg-black/10 text-[11px] text-white"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="grid gap-3 rounded-xl border border-white/10 bg-black/10 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <h5 className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/60">
                        Shadow
                      </h5>
                      <Switch
                        checked={shadowEnabled}
                        disabled={!canEdit}
                        onCheckedChange={(enabled) => {
                          setShadowEnabled(enabled);
                          applyShadow({
                            enabled,
                            blur: shadowBlur,
                            offsetX: shadowOffsetX,
                            offsetY: shadowOffsetY,
                            color: shadowColor,
                          });
                        }}
                      />
                    </div>

                    {shadowEnabled && (
                      <div className="space-y-3">
                        <div className="grid gap-2">
                          <Label className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/60">
                            Blur ({shadowBlur})
                          </Label>
                          <input
                            type="range"
                            min={0}
                            max={60}
                            value={shadowBlur}
                            disabled={!canEdit}
                            onChange={(event) => {
                              const next = clampNumber(Number(event.target.value), 0, 60);
                              setShadowBlur(next);
                              applyShadow({
                                enabled: true,
                                blur: next,
                                offsetX: shadowOffsetX,
                                offsetY: shadowOffsetY,
                                color: shadowColor,
                              });
                            }}
                            className="accent-white"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="grid gap-2">
                            <Label className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/60">
                              X
                            </Label>
                            <Input
                              type="number"
                              value={shadowOffsetX}
                              disabled={!canEdit}
                              onChange={(event) => {
                                const next = clampNumber(Number(event.target.value), -50, 50);
                                setShadowOffsetX(next);
                                applyShadow({
                                  enabled: true,
                                  blur: shadowBlur,
                                  offsetX: next,
                                  offsetY: shadowOffsetY,
                                  color: shadowColor,
                                });
                              }}
                              className="h-10 rounded-xl border-white/10 bg-black/10 text-[11px] text-white"
                            />
                          </div>
                          <div className="grid gap-2">
                            <Label className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/60">
                              Y
                            </Label>
                            <Input
                              type="number"
                              value={shadowOffsetY}
                              disabled={!canEdit}
                              onChange={(event) => {
                                const next = clampNumber(Number(event.target.value), -50, 50);
                                setShadowOffsetY(next);
                                applyShadow({
                                  enabled: true,
                                  blur: shadowBlur,
                                  offsetX: shadowOffsetX,
                                  offsetY: next,
                                  color: shadowColor,
                                });
                              }}
                              className="h-10 rounded-xl border-white/10 bg-black/10 text-[11px] text-white"
                            />
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={shadowColor}
                            disabled={!canEdit}
                            onChange={(event) => {
                              const next = event.target.value;
                              setShadowColor(next);
                              applyShadow({
                                enabled: true,
                                blur: shadowBlur,
                                offsetX: shadowOffsetX,
                                offsetY: shadowOffsetY,
                                color: next,
                              });
                            }}
                            className="h-10 w-12 cursor-pointer rounded-xl border border-white/10 bg-black/10 p-1"
                            aria-label="Shadow color picker"
                          />
                          <Input
                            value={shadowColor}
                            disabled={!canEdit}
                            onChange={(event) => {
                              const next = event.target.value;
                              setShadowColor(next);
                              applyShadow({
                                enabled: true,
                                blur: shadowBlur,
                                offsetX: shadowOffsetX,
                                offsetY: shadowOffsetY,
                                color: next,
                              });
                            }}
                            className="h-10 flex-1 rounded-xl border-white/10 bg-black/10 text-[11px] text-white"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="grid gap-3 rounded-xl border border-white/10 bg-black/10 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <h5 className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/60">
                        Background
                      </h5>
                      <Switch
                        checked={backgroundEnabled}
                        disabled={!canEdit}
                        onCheckedChange={(enabled) => {
                          setBackgroundEnabled(enabled);
                          applyBackground({
                            enabled,
                            color: backgroundColor,
                            padding: backgroundPadding,
                          });
                        }}
                      />
                    </div>

                    {backgroundEnabled && (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={backgroundColor}
                            disabled={!canEdit}
                            onChange={(event) => {
                              const next = event.target.value;
                              setBackgroundColor(next);
                              applyBackground({
                                enabled: true,
                                color: next,
                                padding: backgroundPadding,
                              });
                            }}
                            className="h-10 w-12 cursor-pointer rounded-xl border border-white/10 bg-black/10 p-1"
                            aria-label="Background color picker"
                          />
                          <Input
                            value={backgroundColor}
                            disabled={!canEdit}
                            onChange={(event) => {
                              const next = event.target.value;
                              setBackgroundColor(next);
                              applyBackground({
                                enabled: true,
                                color: next,
                                padding: backgroundPadding,
                              });
                            }}
                            className="h-10 flex-1 rounded-xl border-white/10 bg-black/10 text-[11px] text-white"
                          />
                        </div>

                        <div className="grid gap-2">
                          <Label className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/60">
                            Padding ({backgroundPadding}px)
                          </Label>
                          <input
                            type="range"
                            min={0}
                            max={80}
                            value={backgroundPadding}
                            disabled={!canEdit}
                            onChange={(event) => {
                              const next = clampNumber(Number(event.target.value), 0, 80);
                              setBackgroundPadding(next);
                              applyBackground({
                                enabled: true,
                                color: backgroundColor,
                                padding: next,
                              });
                            }}
                            className="accent-white"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
