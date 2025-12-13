import { useCallback, useEffect, useMemo, useState } from "react";

import * as fabric from "fabric";

const clampNumber = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

export const useCanvasZoom = (params: {
  canvas?: fabric.Canvas;
  minZoom?: number;
  maxZoom?: number;
  step?: number;
}) => {
  const { canvas } = params;
  const minZoom = params.minZoom ?? 0.25;
  const maxZoom = params.maxZoom ?? 4;
  const step = params.step ?? 0.12;

  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    if (!canvas) {
      setZoom(1);
      return;
    }

    setZoom(canvas.getZoom());
  }, [canvas]);

  const zoomTo = useCallback(
    (value: number) => {
      if (!canvas) return;
      const next = clampNumber(value, minZoom, maxZoom);
      const point = new fabric.Point(canvas.getWidth() / 2, canvas.getHeight() / 2);
      canvas.zoomToPoint(point, next);
      canvas.requestRenderAll();
      setZoom(next);
    },
    [canvas, maxZoom, minZoom],
  );

  const zoomIn = useCallback(() => {
    zoomTo(zoom + step);
  }, [step, zoom, zoomTo]);

  const zoomOut = useCallback(() => {
    zoomTo(zoom - step);
  }, [step, zoom, zoomTo]);

  const zoomLabel = useMemo(() => `${Math.round(zoom * 100)}%`, [zoom]);

  return useMemo(
    () => ({
      zoom,
      zoomLabel,
      zoomIn,
      zoomOut,
      zoomTo,
    }),
    [zoom, zoomIn, zoomLabel, zoomOut, zoomTo],
  );
};
