import { describe, expect, it, vi } from "vitest";

import type { Layer } from "../types/layer.types";
import {
  createLayerId,
  ensureFabricLayerMetadata,
  serializeLayer,
} from "../utils/layer-serialization";

interface FabricObjectStub {
  type: string;
  left?: number;
  top?: number;
  angle?: number;
  opacity?: number;
  text?: string;
  fill?: string;
  fontFamily?: string;
  fontSize?: number;
  width?: number;
  height?: number;
  scaleX?: number;
  scaleY?: number;
  layerId?: string;
  layerType?: string;
  layerName?: string;
  isLocked?: boolean;
  isHidden?: boolean;
  zIndex?: number;
  customData?: Record<string, unknown>;
  getScaledWidth: () => number;
  getScaledHeight: () => number;
  set: (props: Record<string, unknown>) => void;
  toObject: (props: string[]) => Record<string, unknown>;
  getSrc?: () => string;
  _objects?: unknown[];
}

const createStub = (partial: Partial<FabricObjectStub>): FabricObjectStub => {
  const stub: FabricObjectStub = {
    type: "rect",
    left: 10,
    top: 20,
    angle: 0,
    opacity: 1,
    width: 100,
    height: 80,
    scaleX: 1,
    scaleY: 1,
    getScaledWidth: () => (stub.width ?? 0) * (stub.scaleX ?? 1),
    getScaledHeight: () => (stub.height ?? 0) * (stub.scaleY ?? 1),
    set: (props) => {
      Object.assign(stub, props);
    },
    toObject: (props) => {
      const base: Record<string, unknown> = {
        type: stub.type,
        left: stub.left,
        top: stub.top,
        angle: stub.angle,
        opacity: stub.opacity,
      };
      props.forEach((prop) => {
        base[prop] = (stub as unknown as Record<string, unknown>)[prop];
      });
      return base;
    },
    ...partial,
  };

  return stub;
};

describe("layer serialization", () => {
  it("generates stable layer ids with prefixes", () => {
    const id = createLayerId("layer");
    expect(id.startsWith("layer_")).toBe(true);
  });

  it("ensures fabric objects contain layer metadata", () => {
    const object = createStub({});
    const setSpy = vi.fn(object.set);
    object.set = setSpy;

    const meta = ensureFabricLayerMetadata(object as unknown as never, { layerType: "text" });

    expect(meta.layerType).toBe("text");
    expect(meta.layerId).toMatch(/^layer_/);
    expect(setSpy).toHaveBeenCalled();
  });

  it("serializes a text layer with typography details", () => {
    const object = createStub({
      type: "textbox",
      text: "Hello",
      fontFamily: "Inter",
      fontSize: 32,
      fill: "rgba(255,255,255,1)",
    });

    const layer = serializeLayer(object as unknown as never, { zIndex: 2 }) as Layer;

    expect(layer.layerType).toBe("text");
    expect(layer.layerId).toBeDefined();
    expect(layer.zIndex).toBe(2);

    if (layer.layerType === "text") {
      expect(layer.text).toBe("Hello");
      expect(layer.fontFamily).toBe("Inter");
      expect(layer.fontSize).toBe(32);
    }
  });

  it("serializes an image layer with src from getSrc fallback", () => {
    const object = createStub({
      type: "image",
      getSrc: () => "https://cdn.lumi.test/design.png",
    });

    const layer = serializeLayer(object as unknown as never, { zIndex: 0 });

    expect(layer.layerType).toBe("image");
    if (layer.layerType === "image") {
      expect(layer.src).toBe("https://cdn.lumi.test/design.png");
    }
  });

  it("serializes a group layer with child ids when available", () => {
    const child = createStub({ type: "rect", layerId: "child_1" });
    const object = createStub({
      type: "group",
      _objects: [child],
    });

    const layer = serializeLayer(object as unknown as never, { zIndex: 1 });

    expect(layer.layerType).toBe("group");
    if (layer.layerType === "group") {
      expect(layer.childLayerIds).toEqual(["child_1"]);
    }
  });
});
