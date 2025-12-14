"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type * as fabric from "fabric";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";

import { toast } from "@/hooks/use-toast";
import { apiClient } from "@/lib/api-client";
import { env } from "@/lib/env";
import { sessionStore } from "@/store/session";

import { sessionKeys } from "./session.keys";
import type { Layer } from "../types/layer.types";
import type { PreviewLayer } from "./usePreviewGeneration";
import { serializePreviewLayers } from "./usePreviewGeneration";
import type { DesignSessionShareResult, DesignSessionView } from "../types/session.types";
import { designSessionShareSchema, designSessionViewSchema } from "../types/session.types";

export interface SaveDesignMeta {
  name: string;
  tags: string[];
  isPublic: boolean;
}

export interface SaveDesignResult {
  session: DesignSessionView;
  share?: DesignSessionShareResult;
}

export interface UseSaveDesignOptions {
  canvas?: fabric.Canvas;
  layers: Layer[];
  productId?: string;
  designArea?: string;
  initialSessionId?: string;
  meta: SaveDesignMeta;
  autoSaveIntervalMs?: number;
  autoSaveStorageKey?: string;
}

type SaveReason = "manual" | "auto" | "unload";

interface SessionSaveBody {
  sessionId?: string;
  productId: string;
  designArea: string;
  layers: PreviewLayer[];
  sessionData: Record<string, unknown>;
}

const AUTOSAVE_DEFAULT_INTERVAL_MS = 60_000;
const AUTOSAVE_STORAGE_KEY = "lumi.editor.autosave";

const apiBaseUrl = env.NEXT_PUBLIC_API_URL.replace(/\/+$/u, "");

const readStorageBoolean = (key: string, fallback: boolean): boolean => {
  if (typeof window === "undefined") return fallback;
  try {
    const value = window.localStorage.getItem(key);
    if (value === null) return fallback;
    return value === "true";
  } catch {
    return fallback;
  }
};

const writeStorageBoolean = (key: string, value: boolean): void => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, value ? "true" : "false");
  } catch {
    // Ignore storage failures (private mode, etc.)
  }
};

const normalizeTags = (value: string[]): string[] => {
  const unique = new Set<string>();
  value
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0)
    .forEach((tag) => {
      unique.add(tag.slice(0, 40));
    });
  return [...unique].slice(0, 40);
};

const buildSessionData = (meta: SaveDesignMeta, layers: Layer[]): Record<string, unknown> => {
  const trimmedName = meta.name.trim().slice(0, 120);

  return {
    lumiEditor: {
      version: 1,
      name: trimmedName.length > 0 ? trimmedName : "Untitled",
      tags: normalizeTags(meta.tags),
      editorLayers: layers,
      savedAt: new Date().toISOString(),
    },
  };
};

const createAuthHeaders = (): Record<string, string> => {
  const token = sessionStore.getState().accessToken;
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const saveSessionKeepalive = async (payload: SessionSaveBody): Promise<void> => {
  const response = await fetch(`${apiBaseUrl}/sessions/save`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...createAuthHeaders(),
    },
    credentials: "include",
    keepalive: true,
    body: JSON.stringify(payload),
  });

  if (response.ok) return;

  // Intentionally ignore response body parsing failures here; this is a best-effort fire-and-forget.
  throw new Error(`Auto-save failed (${response.status})`);
};

const shareSession = async (sessionId: string): Promise<DesignSessionShareResult> => {
  const response = await apiClient.post(`/sessions/${sessionId}/share`, {
    body: {},
    dataSchema: designSessionShareSchema,
  });
  return response.data;
};

export const useSaveDesign = ({
  canvas,
  layers,
  productId,
  designArea,
  initialSessionId,
  meta,
  autoSaveIntervalMs = AUTOSAVE_DEFAULT_INTERVAL_MS,
  autoSaveStorageKey = AUTOSAVE_STORAGE_KEY,
}: UseSaveDesignOptions) => {
  const queryClient = useQueryClient();

  const [sessionId, setSessionId] = useState<string | undefined>(initialSessionId);
  const [autoSaveEnabled, setAutoSaveEnabledState] = useState<boolean>(() =>
    readStorageBoolean(autoSaveStorageKey, true),
  );
  const [dirty, setDirty] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | undefined>();
  const [lastResult, setLastResult] = useState<SaveDesignResult | undefined>();

  const dirtyRef = useRef(dirty);
  const metaRef = useRef(meta);
  const layersRef = useRef(layers);
  const sessionIdRef = useRef<string | undefined>(sessionId);

  useEffect(() => {
    dirtyRef.current = dirty;
  }, [dirty]);

  useEffect(() => {
    metaRef.current = meta;
  }, [meta]);

  useEffect(() => {
    layersRef.current = layers;
  }, [layers]);

  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  const canSave = Boolean(canvas && productId && designArea);

  useEffect(() => {
    if (!canvas) return () => {};

    const markDirty = () => setDirty(true);

    canvas.on("object:added", markDirty);
    canvas.on("object:modified", markDirty);
    canvas.on("object:removed", markDirty);
    canvas.on("text:changed", markDirty);

    return () => {
      canvas.off("object:added", markDirty);
      canvas.off("object:modified", markDirty);
      canvas.off("object:removed", markDirty);
      canvas.off("text:changed", markDirty);
    };
  }, [canvas]);

  const mutation = useMutation<SaveDesignResult, Error, { reason: SaveReason; silent: boolean }>({
    mutationKey: sessionKeys.saves(),
    mutationFn: async ({ reason }) => {
      if (!canvas || !productId || !designArea) {
        throw new Error("Design editor is not ready yet.");
      }

      const previewLayers = serializePreviewLayers(canvas);
      if (previewLayers.length === 0) {
        throw new Error("Add at least one visible layer before saving.");
      }

      const payload: SessionSaveBody = {
        sessionId: sessionIdRef.current,
        productId,
        designArea,
        layers: previewLayers,
        sessionData: buildSessionData(metaRef.current, layersRef.current),
      };

      if (reason === "unload") {
        await saveSessionKeepalive(payload);

        // Keepalive saves cannot be awaited for a session id; we rely on the existing one.
        return {
          session: {
            id: sessionIdRef.current ?? "unknown",
            userId: undefined,
            productId,
            designArea,
            sessionData: payload.sessionData,
            previewUrl: undefined,
            thumbnailUrl: undefined,
            shareToken: undefined,
            isPublic: false,
            viewCount: 0,
            lastEditedAt: new Date().toISOString(),
            expiresAt: new Date().toISOString(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        };
      }

      const response = await apiClient.post("/sessions/save", {
        body: payload,
        dataSchema: designSessionViewSchema,
      });

      const session = response.data;
      const wantsPublic = Boolean(metaRef.current.isPublic);

      if (!wantsPublic) {
        return { session };
      }

      if (session.isPublic && session.shareToken) {
        return { session };
      }

      const share = await shareSession(session.id);

      return {
        session: {
          ...session,
          isPublic: true,
          shareToken: share.shareToken,
          expiresAt: share.expiresAt,
        },
        share,
      };
    },
    onSuccess: (result, variables) => {
      const { session } = result;

      setLastResult(result);

      if (session.id && session.id !== "unknown") {
        setSessionId(session.id);
      }

      setDirty(false);
      setLastSavedAt(new Date(session.lastEditedAt));

      queryClient.invalidateQueries({ queryKey: sessionKeys.lists() });
      if (session.id && session.id !== "unknown") {
        queryClient.invalidateQueries({ queryKey: sessionKeys.detail(session.id) });
      }

      if (!variables.silent) {
        toast({
          title: "Saved",
          description: "Design saved successfully.",
        });
      }
    },
    onError: (error, variables) => {
      if (variables.silent) return;
      toast({
        title: "Save failed",
        description: error.message || "Failed to save design. Please try again.",
        variant: "destructive",
      });
    },
  });

  const setAutoSaveEnabled = useCallback(
    (enabled: boolean) => {
      setAutoSaveEnabledState(enabled);
      writeStorageBoolean(autoSaveStorageKey, enabled);
    },
    [autoSaveStorageKey],
  );

  const save = useCallback(
    async (options: { reason?: SaveReason; silent?: boolean } = {}): Promise<SaveDesignResult> => {
      const silent = options.silent ?? false;
      const reason = options.reason ?? "manual";
      return mutation.mutateAsync({ reason, silent });
    },
    [mutation],
  );

  useEffect(() => {
    if (!autoSaveEnabled) return () => {};
    if (!canSave) return () => {};

    const interval = window.setInterval(() => {
      if (!dirtyRef.current) return;
      mutation.mutate({ reason: "auto", silent: true });
    }, autoSaveIntervalMs);

    return () => {
      window.clearInterval(interval);
    };
  }, [autoSaveEnabled, autoSaveIntervalMs, canSave, mutation]);

  useEffect(() => {
    if (!autoSaveEnabled) return () => {};
    if (!canSave) return () => {};

    const handleUnload = () => {
      if (!dirtyRef.current) return;

      try {
        mutation.mutate({ reason: "unload", silent: true });
      } catch {
        // Ignore unload failures.
      }
    };

    window.addEventListener("beforeunload", handleUnload);

    return () => {
      window.removeEventListener("beforeunload", handleUnload);
    };
  }, [autoSaveEnabled, canSave, mutation]);

  const statusLabel = useMemo(() => {
    if (!canSave) return "Editor not ready";
    if (mutation.isPending) return "Saving…";
    if (dirty) return "Unsaved changes";
    if (lastSavedAt) return "All changes saved";
    return "Not saved yet";
  }, [canSave, dirty, lastSavedAt, mutation.isPending]);

  const shareUrl = useMemo(() => {
    const share = lastResult?.share;
    const rawUrl = share?.shareUrl;

    let tokenUrl: string | undefined;
    if (lastResult?.session?.isPublic && lastResult.session.shareToken) {
      tokenUrl = `/editor/shared/${lastResult.session.shareToken}`;
    }

    const candidate = rawUrl ?? tokenUrl;
    let resolved: string | undefined;

    if (candidate) {
      const urlSchema = z.string().min(1);
      const parsed = urlSchema.safeParse(candidate);

      if (parsed.success) {
        if (candidate.startsWith("http")) {
          resolved = candidate;
        } else if (typeof window === "undefined") {
          resolved = candidate;
        } else {
          resolved = new URL(candidate, window.location.origin).toString();
        }
      }
    }

    return resolved;
  }, [lastResult?.session?.isPublic, lastResult?.session?.shareToken, lastResult?.share]);

  const markClean = useCallback((when?: Date) => {
    setDirty(false);
    if (when) {
      setLastSavedAt(when);
    }
  }, []);

  return {
    canSave,
    sessionId,
    setSessionId,
    autoSaveEnabled,
    setAutoSaveEnabled,
    dirty,
    lastSavedAt,
    statusLabel,
    isSaving: mutation.isPending,
    error: mutation.error,
    save,
    markClean,
    lastResult,
    shareUrl,
  };
};
