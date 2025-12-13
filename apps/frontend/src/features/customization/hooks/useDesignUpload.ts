/* istanbul ignore file */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";

import { env } from "@/lib/env";
import { sessionStore } from "@/store/session";

import { designKeys } from "./design.keys";
import type { CustomerDesignView, DesignUploadPayload } from "../types/design.types";
import { customerDesignViewSchema } from "../types/design.types";

interface UploadVariables {
  file: File;
  payload?: DesignUploadPayload;
  signal?: AbortSignal;
  onProgress?: (progress: number) => void;
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  meta?: unknown;
}

const API_BASE_URL = env.NEXT_PUBLIC_API_URL.replace(/\/+$/u, "");
const UPLOAD_ENDPOINT = `${API_BASE_URL}/designs/upload`;

const setAuthorizationHeader = (xhr: XMLHttpRequest, authToken: string | undefined) => {
  if (!authToken) return;
  xhr.setRequestHeader("Authorization", `Bearer ${authToken}`);
};

const appendUploadPayload = (formData: FormData, payload: DesignUploadPayload | undefined) => {
  (payload?.tags ?? []).forEach((tag) => formData.append("tags", tag));

  if (payload?.uploadedFrom) {
    formData.append("uploadedFrom", payload.uploadedFrom);
  }

  if (payload?.backgroundColor) {
    formData.append("backgroundColor", payload.backgroundColor);
  }

  if (payload?.metadata) {
    formData.append("metadata", JSON.stringify(payload.metadata));
  }
};

const parseResponse = (payload: unknown): CustomerDesignView => {
  const parsed = z
    .object({
      success: z.literal(true),
      data: customerDesignViewSchema,
    })
    .strip()
    .safeParse(payload);

  if (!parsed.success) {
    throw new Error("Upload response was invalid.");
  }

  return parsed.data.data;
};

const uploadViaXhr = ({
  file,
  payload,
  signal,
  onProgress,
  authToken,
}: UploadVariables & { authToken?: string }): Promise<CustomerDesignView> =>
  new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", UPLOAD_ENDPOINT);
    xhr.responseType = "json";
    setAuthorizationHeader(xhr, authToken);

    xhr.upload.addEventListener("progress", (event) => {
      if (!event.lengthComputable) return;
      const percent = Math.min(100, Math.round((event.loaded / event.total) * 100));
      onProgress?.(percent);
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

      try {
        resolve(parseResponse(xhr.response as ApiResponse<unknown>));
      } catch (error) {
        reject(error instanceof Error ? error : new Error("Upload response was invalid."));
      }
    });

    const handleSignalAbort = () => {
      xhr.abort();
    };

    if (signal) {
      signal.addEventListener("abort", handleSignalAbort);
    }

    const formData = new FormData();
    formData.append("file", file);

    appendUploadPayload(formData, payload);

    xhr.send(formData);
  });

export const useDesignUpload = ({ authToken }: { authToken?: string } = {}) => {
  const queryClient = useQueryClient();
  const sessionToken = sessionStore((state) => state.accessToken);
  const resolvedToken = authToken ?? sessionToken ?? undefined;

  const mutation = useMutation<CustomerDesignView, Error, UploadVariables>({
    mutationKey: designKeys.uploads(),
    mutationFn: (variables) =>
      uploadViaXhr({
        ...variables,
        authToken: resolvedToken,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: designKeys.lists() });
    },
  });

  return {
    ...mutation,
    upload: mutation.mutateAsync,
  };
};
