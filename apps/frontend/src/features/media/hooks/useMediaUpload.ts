import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { MediaAsset, MediaUploadPayload } from "../types/media.types";
import { mediaKeys } from "./media.keys";

interface UploadVariables {
  file: File;
  payload: MediaUploadPayload;
  signal?: AbortSignal;
  onProgress?: (progress: number) => void;
}

interface UploadResponse {
  uploads: MediaAsset[];
  failures: { fileName: string; message: string }[];
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  meta?: unknown;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api/v1";
const UPLOAD_ENDPOINT = `${API_BASE_URL}/media/upload`;

const toMediaAsset = (input: MediaAsset): MediaAsset => ({
  ...input,
  usage: input.usage ?? { products: [], variants: [] },
  createdAt: input.createdAt ?? new Date().toISOString(),
  updatedAt: input.updatedAt ?? new Date().toISOString(),
});

const uploadViaXhr = ({
  file,
  payload,
  onProgress,
  signal,
  authToken,
}: UploadVariables & { authToken?: string }): Promise<MediaAsset> =>
  new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", UPLOAD_ENDPOINT);
    xhr.responseType = "json";
    if (authToken) {
      xhr.setRequestHeader("Authorization", `Bearer ${authToken}`);
    }

    xhr.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) {
        const percent = Math.min(100, Math.round((event.loaded / event.total) * 100));
        onProgress?.(percent);
      }
    });

    xhr.addEventListener("error", () => {
      reject(new Error("Network error during upload."));
    });

    xhr.addEventListener("abort", () => {
      reject(new DOMException("Upload aborted", "AbortError"));
    });

    xhr.addEventListener("load", () => {
      if (xhr.status < 200 || xhr.status >= 300) {
        reject(new Error(`Upload failed (${xhr.status})`));
        return;
      }

      const payloadResponse = xhr.response as ApiResponse<UploadResponse>;
      const firstUpload = payloadResponse.data.uploads[0];
      if (!firstUpload) {
        reject(new Error("Upload response was empty."));
        return;
      }
      resolve(toMediaAsset(firstUpload));
    });

    const handleSignalAbort = () => {
      xhr.abort();
    };

    if (signal) {
      signal.addEventListener("abort", handleSignalAbort);
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("folder", payload.folder);
    formData.append("visibility", payload.visibility ?? "public");
    (payload.tags ?? []).forEach((tag: string) => formData.append("tags", tag));
    if (payload.metadata) {
      formData.append("metadata", JSON.stringify(payload.metadata));
    }

    xhr.send(formData);
  });

export const useMediaUpload = ({ authToken }: { authToken?: string } = {}) => {
  const queryClient = useQueryClient();

  const mutation = useMutation<MediaAsset, Error, UploadVariables>({
    mutationKey: mediaKeys.upload(),
    mutationFn: (variables) =>
      uploadViaXhr({
        ...variables,
        authToken,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: mediaKeys.all });
    },
  });

  return {
    ...mutation,
    upload: mutation.mutateAsync,
  };
};
