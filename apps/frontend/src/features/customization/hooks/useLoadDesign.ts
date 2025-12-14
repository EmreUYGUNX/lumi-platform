"use client";

import { useMemo } from "react";

import type * as fabric from "fabric";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";

import { toast } from "@/hooks/use-toast";
import { apiClient, isErrorResponse } from "@/lib/api-client";
import { env } from "@/lib/env";
import { sessionStore } from "@/store/session";

import { sessionKeys } from "./session.keys";
import type { Layer } from "../types/layer.types";
import type {
  DesignSessionSummaryView,
  DesignSessionView,
  SavedDesignMeta,
  SessionListMeta,
  SessionListQuery,
} from "../types/session.types";
import {
  designSessionSummarySchema,
  designSessionViewSchema,
  savedDesignSessionDataSchema,
  savedEditorLayersSchema,
  sessionListMetaSchema,
} from "../types/session.types";
import { deserializeLayer } from "../utils/layer-serialization";
import { ensureGoogleFontsStylesheet, FONT_FAMILIES } from "../utils/text-fonts";

const apiBaseUrl = env.NEXT_PUBLIC_API_URL.replace(/\/+$/u, "");

const createAuthHeaders = (): Record<string, string> => {
  const token = sessionStore.getState().accessToken;
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const deleteSessionRequest = async (sessionId: string): Promise<void> => {
  const response = await fetch(`${apiBaseUrl}/sessions/${sessionId}`, {
    method: "DELETE",
    headers: {
      Accept: "application/json",
      ...createAuthHeaders(),
    },
    credentials: "include",
  });

  if (response.status === 204) return;

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    // ignore parse failures
  }
  if (payload && isErrorResponse(payload)) {
    throw new Error(payload.error.message);
  }

  throw new Error(`Delete failed (${response.status})`);
};

const clearCanvasObjects = (canvas: fabric.Canvas): void => {
  canvas.getObjects().forEach((object) => {
    canvas.remove(object);
  });
  canvas.discardActiveObject();
};

const normalizeSavedMeta = (meta: unknown): SavedDesignMeta => {
  const parsed = z
    .object({
      name: z.string().trim().min(1).max(120),
      tags: z.array(z.string().trim().min(1).max(40)).max(40).default([]),
    })
    .strip()
    .safeParse(meta);

  if (!parsed.success) {
    return { name: "Untitled", tags: [] };
  }

  return parsed.data;
};

const extractEditorLayers = (sessionData: unknown): Layer[] | undefined => {
  const parsedSessionData = savedDesignSessionDataSchema.safeParse(sessionData);
  if (!parsedSessionData.success) return undefined;
  const candidate = parsedSessionData.data.lumiEditor?.editorLayers;
  if (!candidate) return undefined;

  const layersResult = savedEditorLayersSchema.safeParse(candidate);
  if (!layersResult.success) return undefined;
  return layersResult.data as unknown as Layer[];
};

const extractEditorMeta = (sessionData: unknown): SavedDesignMeta => {
  const parsedSessionData = savedDesignSessionDataSchema.safeParse(sessionData);
  if (!parsedSessionData.success) return { name: "Untitled", tags: [] };

  const data = parsedSessionData.data.lumiEditor;
  return normalizeSavedMeta({ name: data?.name ?? "Untitled", tags: data?.tags ?? [] });
};

const collectMissingFonts = (layers: Layer[]): string[] => {
  if (typeof document === "undefined") return [];

  const knownFonts = new Set<string>(FONT_FAMILIES.map((font) => font.toLowerCase()));
  const missing = new Set<string>();

  layers.forEach((layer) => {
    if (layer.layerType !== "text") return;
    const family = layer.fontFamily.trim();
    if (!family) return;

    if (!knownFonts.has(family.toLowerCase())) {
      missing.add(family);
    }
  });

  return [...missing];
};

export interface LoadDesignResult {
  session: DesignSessionView;
  meta: SavedDesignMeta;
  restoredLayers: number;
  failedLayers: number;
}

export interface UseLoadDesignOptions {
  query?: SessionListQuery;
}

export const useLoadDesign = (options: UseLoadDesignOptions = {}) => {
  const queryClient = useQueryClient();

  const query = useMemo<SessionListQuery>(() => options.query ?? {}, [options.query]);

  const listSessions = useInfiniteQuery<{
    data: DesignSessionSummaryView[];
    meta?: SessionListMeta;
  }>({
    queryKey: sessionKeys.list(query),
    queryFn: async ({ pageParam }) => {
      const page = typeof pageParam === "number" ? pageParam : 1;

      const response = await apiClient.get("/sessions", {
        query: {
          page,
          perPage: query.perPage,
          productId: query.productId,
          order: query.order,
        },
        dataSchema: z.array(designSessionSummarySchema),
        metaSchema: sessionListMetaSchema,
      });

      return { data: response.data, meta: response.meta };
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const pagination = lastPage.meta?.pagination;
      let nextPage: number | undefined;

      if (pagination?.hasNextPage) {
        nextPage = pagination.page + 1;
      }

      return nextPage;
    },
    staleTime: 10_000,
    gcTime: 60_000,
  });

  const sessionSummaries = useMemo(
    () => listSessions.data?.pages.flatMap((page) => page.data) ?? [],
    [listSessions.data?.pages],
  );

  const deleteDesign = useMutation<void, Error, string>({
    mutationKey: [sessionKeys.all, "delete"],
    mutationFn: deleteSessionRequest,
    onSuccess: (_data, deletedId) => {
      queryClient.invalidateQueries({ queryKey: sessionKeys.lists() });
      queryClient.removeQueries({ queryKey: sessionKeys.detail(deletedId) });
      toast({ title: "Deleted", description: "Design session deleted." });
    },
    onError: (error) => {
      toast({
        title: "Delete failed",
        description: error.message || "Unable to delete design session.",
        variant: "destructive",
      });
    },
  });

  const loadMutation = useMutation<
    LoadDesignResult,
    Error,
    { sessionId: string; canvas: fabric.Canvas }
  >({
    mutationKey: [sessionKeys.all, "load"],
    mutationFn: async ({ sessionId, canvas }) => {
      const response = await apiClient.get(`/sessions/${sessionId}`, {
        dataSchema: designSessionViewSchema,
      });

      const session = response.data;
      const meta = extractEditorMeta(session.sessionData);
      const editorLayers = extractEditorLayers(session.sessionData);

      if (!editorLayers || editorLayers.length === 0) {
        throw new Error("This saved design cannot be restored (missing layer data).");
      }

      ensureGoogleFontsStylesheet();
      const missingFonts = collectMissingFonts(editorLayers);

      clearCanvasObjects(canvas);

      const orderedLayers = [...editorLayers].sort((a, b) => a.zIndex - b.zIndex);
      const results = await Promise.allSettled(
        orderedLayers.map((layer) => deserializeLayer(layer)),
      );

      let restored = 0;
      let failed = 0;

      results.forEach((result) => {
        if (result.status === "fulfilled") {
          canvas.add(result.value);
          restored += 1;
          return;
        }

        failed += 1;
      });

      canvas.requestRenderAll();

      if (missingFonts.length > 0) {
        toast({
          title: "Font fallback applied",
          description: `Some fonts are not available: ${missingFonts.slice(0, 3).join(", ")}${
            missingFonts.length > 3 ? "…" : ""
          }`,
        });
      }

      if (failed > 0) {
        toast({
          title: "Partial restore",
          description: `${failed} layer(s) could not be restored (missing images or unsupported data).`,
        });
      }

      return { session, meta, restoredLayers: restored, failedLayers: failed };
    },
    onSuccess: (result) => {
      queryClient.setQueryData(sessionKeys.detail(result.session.id), result.session);
    },
    onError: (error) => {
      toast({
        title: "Load failed",
        description: error.message || "Unable to load saved design.",
        variant: "destructive",
      });
    },
  });

  return {
    listSessions,
    sessionSummaries,
    deleteDesign,
    loadMutation,
    loadDesign: loadMutation.mutateAsync,
  };
};
