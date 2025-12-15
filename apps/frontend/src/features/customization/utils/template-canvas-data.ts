import type { Layer } from "../types/layer.types";
import { savedDesignSessionDataSchema, savedEditorLayersSchema } from "../types/session.types";

export const buildTemplateCanvasData = (params: {
  name: string;
  tags: string[];
  layers: Layer[];
}): unknown => {
  return {
    lumiEditor: {
      version: 1,
      name: params.name,
      tags: params.tags,
      editorLayers: params.layers,
    },
  };
};

export const extractTemplateLayers = (canvasData: unknown): Layer[] | undefined => {
  const parsedSessionData = savedDesignSessionDataSchema.safeParse(canvasData);
  if (!parsedSessionData.success) return undefined;

  const candidate = parsedSessionData.data.lumiEditor?.editorLayers;
  if (!candidate) return undefined;

  const layersResult = savedEditorLayersSchema.safeParse(candidate);
  if (!layersResult.success) return undefined;
  return layersResult.data as unknown as Layer[];
};
