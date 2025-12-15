"use client";

import { useMutation } from "@tanstack/react-query";

import { env } from "@/lib/env";
import { sessionStore, uiStore } from "@/store";

import { productionKeys } from "./production.keys";

const resolveFilename = (contentDisposition: string | null): string | undefined => {
  if (!contentDisposition) return undefined;

  const match = contentDisposition.match(/filename\\*?=(?:UTF-8''|\"?)([^\";]+)\"?/iu);
  if (!match?.[1]) return undefined;

  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
};

const triggerBrowserDownload = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
};

export const useBatchDownloadProduction = () => {
  return useMutation<void, Error, string[]>({
    mutationKey: productionKeys.batchDownload(),
    mutationFn: async (orderIds) => {
      const uniqueOrderIds = [...new Set(orderIds.map((id) => id.trim()).filter(Boolean))];
      if (uniqueOrderIds.length === 0) {
        throw new Error("Select at least one order.");
      }
      if (uniqueOrderIds.length > 50) {
        throw new Error("Batch download is limited to 50 orders.");
      }

      const token = sessionStore.getState().accessToken;
      const baseUrl = env.NEXT_PUBLIC_API_URL.replace(/\/+$/u, "");
      const response = await fetch(`${baseUrl}/admin/production/batch/download`, {
        method: "POST",
        credentials: "include",
        headers: {
          Accept: "application/zip",
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ orderIds: uniqueOrderIds }),
      });

      if (!response.ok) {
        const message = `Batch download failed (HTTP ${response.status}).`;
        throw new Error(message);
      }

      const filename =
        resolveFilename(response.headers.get("content-disposition")) ??
        `production-orders-${new Date().toISOString().replaceAll(/[:.]/gu, "-")}.zip`;

      const blob = await response.blob();
      triggerBrowserDownload(blob, filename);

      uiStore.getState().enqueueToast({
        variant: "success",
        title: "Download started",
        description: "Production archive is downloading.",
      });
    },
    onError: (error) => {
      uiStore.getState().enqueueToast({
        variant: "error",
        title: "Batch download failed",
        description: error.message || "Unable to download production archive.",
      });
    },
  });
};
