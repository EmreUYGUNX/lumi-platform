export interface DesignArea {
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  minDesignSize: number;
  maxDesignSize: number;
  aspectRatio?: number;
  allowResize: boolean;
  allowRotation: boolean;
}
