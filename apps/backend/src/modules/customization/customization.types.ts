export interface DesignArea {
  name: string; // "front", "back", "left-sleeve"
  x: number; // Position on product image (px)
  y: number;
  width: number; // Design area dimensions (px)
  height: number;
  rotation: number; // Area rotation (degrees)
  minDesignSize: number; // Min design dimension (px)
  maxDesignSize: number; // Max design dimension (px)
  aspectRatio?: number; // Enforce aspect ratio (optional)
  allowResize: boolean; // Allow user to resize design
  allowRotation: boolean; // Allow user to rotate design
}

export interface ProductCustomizationConfig {
  enabled: boolean;
  designAreas: DesignArea[];
  maxLayers: number;
  allowImages: boolean;
  allowText: boolean;
  allowShapes: boolean;
  allowDrawing: boolean;
  minImageSize?: number;
  maxImageSize?: number;
  allowedFonts: string[];
  restrictedWords: string[];
  basePriceModifier: number;
  pricePerLayer: number;
}
