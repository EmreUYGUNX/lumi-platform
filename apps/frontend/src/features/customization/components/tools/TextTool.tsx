"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import * as fabric from "fabric";
import { CaseLower, CaseSensitive, CaseUpper, Pencil, Type } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

import { createLayerId, ensureFabricLayerMetadata } from "../../utils/layer-serialization";

type TextTransform = "none" | "uppercase" | "lowercase" | "capitalize";

const FONT_FAMILIES = [
  "Inter",
  "Roboto",
  "Open Sans",
  "Lato",
  "Montserrat",
  "Poppins",
  "Raleway",
  "Nunito",
  "Work Sans",
  "Source Sans 3",
  "Fira Sans",
  "Merriweather",
  "Playfair Display",
  "Oswald",
  "Bebas Neue",
  "Abril Fatface",
  "Anton",
  "Pacifico",
  "Caveat",
  "DM Sans",
  "Quicksand",
  "Rubik",
] as const;

const DEFAULT_FONT = "Inter";
const FONT_WEIGHTS = ["300", "400", "500", "600", "700", "800"] as const;

const GOOGLE_FONTS_STYLESHEET_ID = "lumi-editor-google-fonts";
const RECENT_FONTS_STORAGE_KEY = "lumi.editor.recent-fonts";
const MAX_RECENT_FONTS = 6;

const clampNumber = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

const buildGoogleFontsUrl = (families: readonly string[]) => {
  const weights = FONT_WEIGHTS.join(";");
  const params = families
    .map((family) => {
      const encoded = encodeURIComponent(family).replaceAll("%20", "+");
      return `family=${encoded}:wght@${weights}`;
    })
    .join("&");

  return `https://fonts.googleapis.com/css2?${params}&display=swap`;
};

const ensureGoogleFontsStylesheet = (): void => {
  if (typeof document === "undefined") return;

  const existing = document.querySelector(`#${GOOGLE_FONTS_STYLESHEET_ID}`);
  if (existing) return;

  const link = document.createElement("link");
  link.id = GOOGLE_FONTS_STYLESHEET_ID;
  link.rel = "stylesheet";
  link.href = buildGoogleFontsUrl(FONT_FAMILIES);
  document.head.append(link);
};

const readRecentFonts = (): string[] => {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RECENT_FONTS_STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : undefined;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((value): value is string => typeof value === "string");
  } catch {
    return [];
  }
};

const writeRecentFonts = (fonts: string[]) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(RECENT_FONTS_STORAGE_KEY, JSON.stringify(fonts));
  } catch {
    // ignore storage failures (private browsing, quota, etc)
  }
};

const isEditableText = (
  object: fabric.Object | undefined,
): object is fabric.Textbox | fabric.IText | fabric.Text => {
  if (!object) return false;
  return object.type === "textbox" || object.type === "i-text" || object.type === "text";
};

const normalizeTextTransform = (value: string): TextTransform => {
  if (value === "uppercase" || value === "lowercase" || value === "capitalize") return value;
  return "none";
};

const applyTransform = (text: string, transform: TextTransform): string => {
  if (!text) return text;
  if (transform === "uppercase") return text.toUpperCase();
  if (transform === "lowercase") return text.toLowerCase();
  if (transform === "capitalize")
    return text.replaceAll(/\b(\p{L})/gu, (match) => match.toUpperCase());
  return text;
};

interface SelectedTextState {
  fontFamily: string;
  fontSize: number;
  fontWeight: (typeof FONT_WEIGHTS)[number];
  textAlign: "left" | "center" | "right";
  letterSpacing: number;
  lineHeight: number;
  fill: string;
  strokeWidth: number;
  stroke: string;
  shadowBlur: number;
  shadowOffsetX: number;
  shadowOffsetY: number;
  shadowColor: string;
  textTransform: TextTransform;
}

const readTextTransform = (object: fabric.Textbox | fabric.IText | fabric.Text): TextTransform => {
  const raw = object as unknown as { customData?: unknown };
  const transform =
    raw.customData && typeof raw.customData === "object" && !Array.isArray(raw.customData)
      ? (raw.customData as Record<string, unknown>).textTransform
      : undefined;
  return typeof transform === "string" ? normalizeTextTransform(transform) : "none";
};

const readShadowState = (shadow: fabric.Shadow | undefined) => {
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
};

const resolveFontWeight = (value: unknown): (typeof FONT_WEIGHTS)[number] => {
  const weight = typeof value === "number" || typeof value === "string" ? String(value) : undefined;
  return weight && FONT_WEIGHTS.includes(weight as (typeof FONT_WEIGHTS)[number])
    ? (weight as (typeof FONT_WEIGHTS)[number])
    : "600";
};

const readSelectedTextState = (
  object: fabric.Textbox | fabric.IText | fabric.Text,
): SelectedTextState => {
  const { shadow } = object;
  const shadowState = readShadowState(shadow as fabric.Shadow | undefined);

  const fontFamily = typeof object.fontFamily === "string" ? object.fontFamily : DEFAULT_FONT;
  const fontSize =
    typeof object.fontSize === "number" && Number.isFinite(object.fontSize) ? object.fontSize : 48;
  const textAlign =
    object.textAlign === "left" || object.textAlign === "right" ? object.textAlign : "center";
  const letterSpacing =
    typeof object.charSpacing === "number" && Number.isFinite(object.charSpacing)
      ? object.charSpacing
      : 0;
  const lineHeight =
    typeof object.lineHeight === "number" && Number.isFinite(object.lineHeight)
      ? object.lineHeight
      : 1.15;
  const fill = typeof object.fill === "string" ? object.fill : "#111827";
  const strokeWidth =
    typeof object.strokeWidth === "number" && Number.isFinite(object.strokeWidth)
      ? object.strokeWidth
      : 0;
  const stroke = typeof object.stroke === "string" ? object.stroke : "#111827";

  return {
    fontFamily,
    fontSize: clampNumber(fontSize, 8, 200),
    fontWeight: resolveFontWeight(object.fontWeight),
    textAlign,
    letterSpacing: clampNumber(letterSpacing, -200, 400),
    lineHeight: clampNumber(lineHeight, 0.6, 3),
    fill,
    strokeWidth: clampNumber(strokeWidth, 0, 24),
    stroke,
    shadowBlur: clampNumber(shadowState.blur, 0, 60),
    shadowOffsetX: clampNumber(shadowState.offsetX, -50, 50),
    shadowOffsetY: clampNumber(shadowState.offsetY, -50, 50),
    shadowColor: shadowState.color,
    textTransform: readTextTransform(object),
  };
};

interface TextToolProps {
  canvas?: fabric.Canvas;
  active: boolean;
  className?: string;
}

export function TextTool({ canvas, active, className }: TextToolProps): JSX.Element {
  const [recentFonts, setRecentFonts] = useState<string[]>(() => readRecentFonts());
  const [fontFamily, setFontFamily] = useState(DEFAULT_FONT);
  const [fontSize, setFontSize] = useState(48);
  const [fontWeight, setFontWeight] = useState<(typeof FONT_WEIGHTS)[number]>("600");
  const [textAlign, setTextAlign] = useState<"left" | "center" | "right">("center");
  const [letterSpacing, setLetterSpacing] = useState(0);
  const [lineHeight, setLineHeight] = useState(1.15);
  const [fill, setFill] = useState("#111827");

  const [strokeWidth, setStrokeWidth] = useState(0);
  const [stroke, setStroke] = useState("#111827");

  const [shadowBlur, setShadowBlur] = useState(0);
  const [shadowOffsetX, setShadowOffsetX] = useState(0);
  const [shadowOffsetY, setShadowOffsetY] = useState(0);
  const [shadowColor, setShadowColor] = useState("#000000");

  const [textTransform, setTextTransform] = useState<TextTransform>("none");

  const canEditText = useMemo(() => {
    const object = canvas?.getActiveObject();
    return Boolean(object && isEditableText(object));
  }, [canvas]);

  const syncFromSelection = useCallback(() => {
    if (!canvas) return;
    const object = canvas.getActiveObject();
    if (!isEditableText(object)) return;

    const nextState = readSelectedTextState(object);
    setFontFamily(nextState.fontFamily);
    setFontSize(nextState.fontSize);
    setFontWeight(nextState.fontWeight);
    setTextAlign(nextState.textAlign);
    setLetterSpacing(nextState.letterSpacing);
    setLineHeight(nextState.lineHeight);
    setFill(nextState.fill);
    setStrokeWidth(nextState.strokeWidth);
    setStroke(nextState.stroke);
    setShadowBlur(nextState.shadowBlur);
    setShadowOffsetX(nextState.shadowOffsetX);
    setShadowOffsetY(nextState.shadowOffsetY);
    setShadowColor(nextState.shadowColor);
    setTextTransform(nextState.textTransform);
  }, [canvas]);

  type TextPatch = Partial<fabric.ITextProps> & {
    text?: string;
    customData?: Record<string, unknown>;
  };

  const applyToActiveText = useCallback(
    (patch: TextPatch) => {
      if (!canvas) return;
      const object = canvas.getActiveObject();
      if (!isEditableText(object)) return;

      if (patch.customData) {
        const raw = object as unknown as { customData?: unknown };
        const base =
          raw.customData && typeof raw.customData === "object" && !Array.isArray(raw.customData)
            ? (raw.customData as Record<string, unknown>)
            : {};
        raw.customData = { ...base, ...patch.customData };
      }

      const { customData: _customData, ...rest } = patch;
      object.set(rest);
      object.setCoords();
      canvas.requestRenderAll();
    },
    [canvas],
  );

  const addTextAt = useCallback(
    (point: { x: number; y: number }) => {
      if (!canvas) return;

      ensureGoogleFontsStylesheet();

      const designWidth = (canvas as unknown as { lumiDesignWidth?: number }).lumiDesignWidth;
      const designHeight = (canvas as unknown as { lumiDesignHeight?: number }).lumiDesignHeight;
      const bounds = {
        width: typeof designWidth === "number" ? designWidth : canvas.getWidth(),
        height: typeof designHeight === "number" ? designHeight : canvas.getHeight(),
      };

      const textbox = new fabric.Textbox("Text", {
        left: clampNumber(point.x, 0, bounds.width),
        top: clampNumber(point.y, 0, bounds.height),
        originX: "center",
        originY: "center",
        width: Math.min(360, bounds.width),
        fontFamily,
        fontSize,
        fontWeight,
        textAlign,
        charSpacing: letterSpacing,
        lineHeight,
        fill,
        stroke,
        strokeWidth,
      });

      if (shadowBlur > 0 || shadowOffsetX !== 0 || shadowOffsetY !== 0) {
        textbox.set({
          shadow: new fabric.Shadow({
            blur: shadowBlur,
            offsetX: shadowOffsetX,
            offsetY: shadowOffsetY,
            color: shadowColor,
          }),
        });
      }

      const layerId = createLayerId("text");
      ensureFabricLayerMetadata(textbox, {
        layerId,
        layerType: "text",
        layerName: "TEXT",
        zIndex: canvas.getObjects().length,
        customData: {
          textTransform,
        },
      });

      if (textTransform !== "none") {
        textbox.set({ text: applyTransform(textbox.text ?? "", textTransform) });
      }

      canvas.add(textbox);
      canvas.setActiveObject(textbox);
      textbox.enterEditing();
      textbox.selectAll();
      canvas.requestRenderAll();
    },
    [
      canvas,
      fill,
      fontFamily,
      fontSize,
      fontWeight,
      letterSpacing,
      lineHeight,
      shadowBlur,
      shadowColor,
      shadowOffsetX,
      shadowOffsetY,
      stroke,
      strokeWidth,
      textAlign,
      textTransform,
    ],
  );

  useEffect(() => {
    ensureGoogleFontsStylesheet();
  }, []);

  useEffect(() => {
    if (!canvas) return () => {};

    const handleSelection = () => syncFromSelection();
    canvas.on("selection:created", handleSelection);
    canvas.on("selection:updated", handleSelection);
    canvas.on("selection:cleared", handleSelection);
    canvas.on("object:modified", handleSelection);
    canvas.on("text:changed", handleSelection);

    syncFromSelection();

    return () => {
      canvas.off("selection:created", handleSelection);
      canvas.off("selection:updated", handleSelection);
      canvas.off("selection:cleared", handleSelection);
      canvas.off("object:modified", handleSelection);
      canvas.off("text:changed", handleSelection);
    };
  }, [canvas, syncFromSelection]);

  useEffect(() => {
    if (!canvas || !active) return () => {};

    const handleClick = (event: fabric.TPointerEventInfo) => {
      if (!active) return;
      if (event.target) return;
      const pointer = canvas.getPointer(event.e);
      addTextAt(pointer);
    };

    canvas.on("mouse:down", handleClick);

    return () => {
      canvas.off("mouse:down", handleClick);
    };
  }, [active, addTextAt, canvas]);

  const commitRecentFont = useCallback(
    (nextFont: string) => {
      const updated = [nextFont, ...recentFonts.filter((entry) => entry !== nextFont)]
        .filter(Boolean)
        .slice(0, MAX_RECENT_FONTS);
      setRecentFonts(updated);
      writeRecentFonts(updated);
    },
    [recentFonts],
  );

  const fontItems = useMemo(() => {
    const recentSet = new Set(recentFonts);
    const recents = recentFonts.filter((font) =>
      FONT_FAMILIES.includes(font as (typeof FONT_FAMILIES)[number]),
    );
    const others = [...FONT_FAMILIES].filter((font) => !recentSet.has(font));
    return { recents, others };
  }, [recentFonts]);

  return (
    <section
      className={cn(
        "flex h-full flex-col gap-4 rounded-2xl border border-white/10 bg-black/5 p-4 text-white/80",
        className,
      )}
      aria-label="Text tool"
    >
      <header className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Type className="h-4 w-4 text-white/70" />
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.28em]">Text</h3>
        </div>

        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="h-8 gap-2 rounded-xl px-3"
          onClick={() => {
            if (!canvas) return;
            const designWidth = (canvas as unknown as { lumiDesignWidth?: number }).lumiDesignWidth;
            const designHeight = (canvas as unknown as { lumiDesignHeight?: number })
              .lumiDesignHeight;
            addTextAt({
              x: typeof designWidth === "number" ? designWidth / 2 : canvas.getWidth() / 2,
              y: typeof designHeight === "number" ? designHeight / 2 : canvas.getHeight() / 2,
            });
          }}
        >
          <Pencil className="h-4 w-4" />
          Add
        </Button>
      </header>

      <div className="grid grid-cols-1 gap-4">
        <div className="grid gap-2">
          <Label className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/60">
            Font
          </Label>
          <Select
            value={fontFamily}
            onValueChange={(value) => {
              setFontFamily(value);
              commitRecentFont(value);
              applyToActiveText({ fontFamily: value });
            }}
          >
            <SelectTrigger className="h-10 rounded-xl border-white/10 bg-black/10 text-[11px] text-white">
              <SelectValue placeholder="Font" />
            </SelectTrigger>
            <SelectContent className="border-white/10 bg-black/90 text-white">
              {fontItems.recents.length > 0 && (
                <SelectGroup>
                  <SelectLabel className="text-[10px] uppercase tracking-[0.22em] text-white/50">
                    Recent
                  </SelectLabel>
                  {fontItems.recents.map((font) => (
                    <SelectItem key={font} value={font}>
                      <span style={{ fontFamily: font }}>{font}</span>
                    </SelectItem>
                  ))}
                </SelectGroup>
              )}
              {fontItems.recents.length > 0 && <SelectSeparator className="bg-white/10" />}
              <SelectGroup>
                <SelectLabel className="text-[10px] uppercase tracking-[0.22em] text-white/50">
                  All fonts
                </SelectLabel>
                {fontItems.others.map((font) => (
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
              onChange={(event) => {
                const next = clampNumber(Number(event.target.value), 8, 200);
                setFontSize(next);
                applyToActiveText({ fontSize: next });
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
                const next = FONT_WEIGHTS.includes(value as (typeof FONT_WEIGHTS)[number])
                  ? (value as (typeof FONT_WEIGHTS)[number])
                  : "600";
                setFontWeight(next);
                applyToActiveText({ fontWeight: next });
              }}
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

        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-2">
            <Label className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/60">
              Align
            </Label>
            <Select
              value={textAlign}
              onValueChange={(value) => {
                const next = value === "left" || value === "right" ? value : "center";
                setTextAlign(next);
                applyToActiveText({ textAlign: next });
              }}
            >
              <SelectTrigger className="h-10 rounded-xl border-white/10 bg-black/10 text-[11px] text-white">
                <SelectValue placeholder="Alignment" />
              </SelectTrigger>
              <SelectContent className="border-white/10 bg-black/90 text-white">
                <SelectItem value="left">Left</SelectItem>
                <SelectItem value="center">Center</SelectItem>
                <SelectItem value="right">Right</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/60">
              Color
            </Label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={fill}
                onChange={(event) => {
                  const next = event.target.value;
                  setFill(next);
                  applyToActiveText({ fill: next });
                }}
                className="h-10 w-12 cursor-pointer rounded-xl border border-white/10 bg-black/10 p-1"
                aria-label="Text color picker"
              />
              <Input
                value={fill}
                onChange={(event) => {
                  const next = event.target.value;
                  setFill(next);
                  applyToActiveText({ fill: next });
                }}
                className="h-10 flex-1 rounded-xl border-white/10 bg-black/10 text-[11px] text-white"
              />
            </div>
          </div>
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
            onChange={(event) => {
              const next = clampNumber(Number(event.target.value), -200, 400);
              setLetterSpacing(next);
              applyToActiveText({ charSpacing: next });
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
            onChange={(event) => {
              const next = clampNumber(Number(event.target.value), 0.6, 3);
              setLineHeight(next);
              applyToActiveText({ lineHeight: next });
            }}
            className="accent-white"
          />
        </div>

        <div className="grid gap-3 rounded-xl border border-white/10 bg-black/10 p-3">
          <h4 className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/60">
            Effects
          </h4>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/60">
                Stroke ({strokeWidth}px)
              </Label>
              <input
                type="range"
                min={0}
                max={24}
                value={strokeWidth}
                onChange={(event) => {
                  const next = clampNumber(Number(event.target.value), 0, 24);
                  setStrokeWidth(next);
                  applyToActiveText({ strokeWidth: next, stroke: next > 0 ? stroke : undefined });
                }}
                className="accent-white"
              />
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={stroke}
                  onChange={(event) => {
                    const next = event.target.value;
                    setStroke(next);
                    applyToActiveText({ stroke: strokeWidth > 0 ? next : undefined });
                  }}
                  className="h-9 w-12 cursor-pointer rounded-xl border border-white/10 bg-black/10 p-1"
                  aria-label="Stroke color picker"
                />
                <Input
                  value={stroke}
                  onChange={(event) => {
                    const next = event.target.value;
                    setStroke(next);
                    applyToActiveText({ stroke: strokeWidth > 0 ? next : undefined });
                  }}
                  className="h-9 flex-1 rounded-xl border-white/10 bg-black/10 text-[11px] text-white"
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/60">
                Shadow ({shadowBlur}px)
              </Label>
              <input
                type="range"
                min={0}
                max={60}
                value={shadowBlur}
                onChange={(event) => {
                  const next = clampNumber(Number(event.target.value), 0, 60);
                  setShadowBlur(next);
                  if (!canvas) return;
                  if (!canEditText) return;
                  applyToActiveText({
                    shadow:
                      next > 0 || shadowOffsetX !== 0 || shadowOffsetY !== 0
                        ? new fabric.Shadow({
                            blur: next,
                            offsetX: shadowOffsetX,
                            offsetY: shadowOffsetY,
                            color: shadowColor,
                          })
                        : undefined,
                  });
                }}
                className="accent-white"
              />

              <div className="grid grid-cols-2 gap-2">
                <Input
                  type="number"
                  value={shadowOffsetX}
                  onChange={(event) => {
                    const next = clampNumber(Number(event.target.value), -50, 50);
                    setShadowOffsetX(next);
                    applyToActiveText({
                      shadow:
                        shadowBlur > 0 || next !== 0 || shadowOffsetY !== 0
                          ? new fabric.Shadow({
                              blur: shadowBlur,
                              offsetX: next,
                              offsetY: shadowOffsetY,
                              color: shadowColor,
                            })
                          : undefined,
                    });
                  }}
                  className="h-9 rounded-xl border-white/10 bg-black/10 text-[11px] text-white"
                  aria-label="Shadow offset X"
                />
                <Input
                  type="number"
                  value={shadowOffsetY}
                  onChange={(event) => {
                    const next = clampNumber(Number(event.target.value), -50, 50);
                    setShadowOffsetY(next);
                    applyToActiveText({
                      shadow:
                        shadowBlur > 0 || shadowOffsetX !== 0 || next !== 0
                          ? new fabric.Shadow({
                              blur: shadowBlur,
                              offsetX: shadowOffsetX,
                              offsetY: next,
                              color: shadowColor,
                            })
                          : undefined,
                    });
                  }}
                  className="h-9 rounded-xl border-white/10 bg-black/10 text-[11px] text-white"
                  aria-label="Shadow offset Y"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={shadowColor}
                  onChange={(event) => {
                    const next = event.target.value;
                    setShadowColor(next);
                    applyToActiveText({
                      shadow:
                        shadowBlur > 0 || shadowOffsetX !== 0 || shadowOffsetY !== 0
                          ? new fabric.Shadow({
                              blur: shadowBlur,
                              offsetX: shadowOffsetX,
                              offsetY: shadowOffsetY,
                              color: next,
                            })
                          : undefined,
                    });
                  }}
                  className="h-9 w-12 cursor-pointer rounded-xl border border-white/10 bg-black/10 p-1"
                  aria-label="Shadow color picker"
                />
                <Input
                  value={shadowColor}
                  onChange={(event) => {
                    const next = event.target.value;
                    setShadowColor(next);
                    applyToActiveText({
                      shadow:
                        shadowBlur > 0 || shadowOffsetX !== 0 || shadowOffsetY !== 0
                          ? new fabric.Shadow({
                              blur: shadowBlur,
                              offsetX: shadowOffsetX,
                              offsetY: shadowOffsetY,
                              color: next,
                            })
                          : undefined,
                    });
                  }}
                  className="h-9 flex-1 rounded-xl border-white/10 bg-black/10 text-[11px] text-white"
                />
              </div>
            </div>
          </div>

          <div className="grid gap-2">
            <Label className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/60">
              Transform
            </Label>
            <Select
              value={textTransform}
              onValueChange={(value) => {
                const next = normalizeTextTransform(value);
                setTextTransform(next);

                if (!canvas) return;
                const object = canvas.getActiveObject();
                if (!isEditableText(object)) return;

                const updatedText = applyTransform(object.text ?? "", next);
                applyToActiveText({
                  text: updatedText,
                  customData: { textTransform: next },
                });
              }}
            >
              <SelectTrigger className="h-10 rounded-xl border-white/10 bg-black/10 text-[11px] text-white">
                <SelectValue placeholder="Transform" />
              </SelectTrigger>
              <SelectContent className="border-white/10 bg-black/90 text-white">
                <SelectItem value="none">
                  <span className="flex items-center gap-2">
                    <CaseSensitive className="h-4 w-4" />
                    None
                  </span>
                </SelectItem>
                <SelectItem value="uppercase">
                  <span className="flex items-center gap-2">
                    <CaseUpper className="h-4 w-4" />
                    Uppercase
                  </span>
                </SelectItem>
                <SelectItem value="lowercase">
                  <span className="flex items-center gap-2">
                    <CaseLower className="h-4 w-4" />
                    Lowercase
                  </span>
                </SelectItem>
                <SelectItem value="capitalize">
                  <span className="flex items-center gap-2">
                    <CaseSensitive className="h-4 w-4" />
                    Capitalize
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="mt-auto rounded-xl border border-white/10 bg-black/10 p-3 text-[11px] text-white/60">
        {active ? (
          <p>Tip: Click empty space on the canvas to add text.</p>
        ) : (
          <p>Select the Text tool to add and edit text layers.</p>
        )}
        {!canEditText && <p className="mt-2">Select a text layer to edit its properties.</p>}
      </div>

      <div className="flex items-center justify-end gap-2">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-9 rounded-xl"
          disabled={!canEditText}
          onClick={() => {
            if (!canvas) return;
            const object = canvas.getActiveObject();
            if (!isEditableText(object)) return;

            const editable = object as unknown as {
              enterEditing?: () => void;
              selectAll?: () => void;
            };

            editable.enterEditing?.();
            editable.selectAll?.();
            canvas.requestRenderAll();
          }}
        >
          Edit text
        </Button>
      </div>
    </section>
  );
}
