import type { DesignArea } from "./customization.types.js";

export interface DesignAreaBounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export const getDesignAreaBounds = (area: DesignArea): DesignAreaBounds => ({
  left: area.x,
  top: area.y,
  right: area.x + area.width,
  bottom: area.y + area.height,
});

export const areAreasOverlapping = (first: DesignArea, second: DesignArea): boolean => {
  const a = getDesignAreaBounds(first);
  const b = getDesignAreaBounds(second);

  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
};

export const isPointInDesignArea = (x: number, y: number, area: DesignArea): boolean => {
  const bounds = getDesignAreaBounds(area);
  return x >= bounds.left && x <= bounds.right && y >= bounds.top && y <= bounds.bottom;
};
