export type LayerType = "image" | "text" | "shape" | "clipart" | "group";

export interface LayerPosition {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
}

export type SerializedFabricObject = Record<string, unknown>;

export interface LayerBase {
  layerId: string;
  layerType: LayerType;
  layerName: string;
  isLocked: boolean;
  isHidden: boolean;
  zIndex: number;
  position: LayerPosition;
  opacity?: number;
  customData?: Record<string, unknown>;
  fabricObject: SerializedFabricObject;
}

export interface ImageLayer extends LayerBase {
  layerType: "image";
  src: string;
  designId?: string;
  publicId?: string;
}

export interface ClipartLayer extends LayerBase {
  layerType: "clipart";
  src: string;
  clipartId: string;
}

export interface TextLayer extends LayerBase {
  layerType: "text";
  text: string;
  fontFamily: string;
  fontSize: number;
  fontWeight?: string | number;
  letterSpacing?: number;
  color?: string;
}

export type ShapeKind = "rect" | "circle" | "polygon";

export interface ShapeLayer extends LayerBase {
  layerType: "shape";
  shape: ShapeKind;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
}

export interface GroupLayer extends LayerBase {
  layerType: "group";
  childLayerIds: string[];
}

export type Layer = ImageLayer | ClipartLayer | TextLayer | ShapeLayer | GroupLayer;
