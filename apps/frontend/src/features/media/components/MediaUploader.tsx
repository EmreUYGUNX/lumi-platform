"use client";

/* istanbul ignore file */
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";

import { useDropzone } from "react-dropzone";

import { useMediaUpload } from "../hooks/useMediaUpload";
import type {
  MediaAsset,
  MediaFolderOption,
  MediaUploadPayload,
  UploadQueueItem,
} from "../types/media.types";
import { DEFAULT_MAX_SIZE_MB, MEDIA_ALLOWED_MIME_TYPES } from "../types/media.types";
import { formatFileSize } from "../utils/media-formatters";
import { MediaImage } from "./MediaImage";
import styles from "./media-uploader.module.css";

/* istanbul ignore file */

const MAX_CONCURRENT_UPLOADS = 5;
const DEFAULT_FOLDER = "lumi/products";

interface MediaUploaderProps {
  folderOptions?: MediaFolderOption[];
  defaultFolder?: string;
  tags?: string[];
  visibility?: "public" | "private" | "internal";
  authToken?: string;
  onUploadSuccess?: (asset: MediaAsset, context: { placeholderId?: string }) => void;
  onUploadFailure?: (item: UploadQueueItem, error: Error) => void;
  onOptimisticAsset?: (asset: MediaAsset, queueId: string) => void;
  onOptimisticRevert?: (queueId: string, asset?: MediaAsset) => void;
}

type QueueAction =
  | { type: "enqueue"; items: UploadQueueItem[] }
  | { type: "update"; id: string; patch: Partial<UploadQueueItem> }
  | { type: "remove"; id: string }
  | { type: "reset" };

const queueReducer = (state: UploadQueueItem[], action: QueueAction): UploadQueueItem[] => {
  switch (action.type) {
    case "enqueue": {
      return [...state, ...action.items];
    }
    case "update": {
      return state.map((item) => (item.id === action.id ? { ...item, ...action.patch } : item));
    }
    case "remove": {
      return state.filter((item) => item.id !== action.id);
    }
    case "reset": {
      return [];
    }
    default: {
      return state;
    }
  }
};

const getMaxSizeForFolder = (folder: string, options?: MediaFolderOption[]): number => {
  const entry = options?.find((option) => option.value === folder);
  return (entry?.maxSizeMb ?? DEFAULT_MAX_SIZE_MB) * 1024 * 1024;
};

const createPlaceholderAsset = (
  item: UploadQueueItem,
  payload: MediaUploadPayload,
): MediaAsset => ({
  id: `optimistic-${item.id}`,
  publicId: `optimistic/${item.id}`,
  folder: payload.folder,
  format: item.file.type.split("/")[1] ?? "jpg",
  resourceType: "image",
  type: "upload",
  bytes: item.file.size,
  url: item.previewUrl,
  secureUrl: item.previewUrl,
  tags: payload.tags ?? [],
  metadata: {
    filename: item.file.name,
    optimistic: true,
  },
  version: 1,
  transformations: {
    thumbnail: item.previewUrl,
    medium: item.previewUrl,
    large: item.previewUrl,
  },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  usage: { products: [], variants: [] },
  isOptimistic: true,
  placeholderId: item.id,
});

const buildAcceptConfig = (): Record<string, string[]> =>
  Object.fromEntries(MEDIA_ALLOWED_MIME_TYPES.map((mime) => [mime, []]));

export function MediaUploader({
  folderOptions,
  defaultFolder,
  tags: defaultTags,
  visibility = "public",
  authToken,
  onUploadSuccess,
  onUploadFailure,
  onOptimisticAsset,
  onOptimisticRevert,
}: MediaUploaderProps) {
  const [queue, dispatch] = useReducer(queueReducer, []);
  const [folder, setFolder] = useState(
    defaultFolder ?? folderOptions?.[0]?.value ?? DEFAULT_FOLDER,
  );
  const [tagInput, setTagInput] = useState(defaultTags?.join(", ") ?? "");
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const controllers = useRef(new Map<string, AbortController>());
  const previewUrls = useRef(new Set<string>());

  const mediaUpload = useMediaUpload({ authToken });

  useEffect(() => {
    if (defaultFolder) {
      setFolder(defaultFolder);
    }
  }, [defaultFolder]);

  useEffect(() => {
    if (defaultTags) {
      setTagInput(defaultTags.join(", "));
    }
  }, [defaultTags]);

  const acceptConfig = useMemo(buildAcceptConfig, []);

  const dropzone = useDropzone({
    accept: acceptConfig,
    multiple: true,
    maxFiles: 10,
    onDropAccepted: (acceptedFiles) => {
      const maxBytes = getMaxSizeForFolder(folder, folderOptions);
      const newErrors: string[] = [];

      const accepted = acceptedFiles.filter((file) => {
        if (
          !MEDIA_ALLOWED_MIME_TYPES.includes(file.type as (typeof MEDIA_ALLOWED_MIME_TYPES)[number])
        ) {
          newErrors.push(`${file.name} has unsupported type (${file.type}).`);
          return false;
        }

        if (file.size > maxBytes) {
          newErrors.push(
            `${file.name} exceeds the ${(maxBytes / (1024 * 1024)).toFixed(1)} MB limit.`,
          );
          return false;
        }

        return true;
      });

      const items: UploadQueueItem[] = accepted.map((file) => {
        const previewUrl = URL.createObjectURL(file);
        previewUrls.current.add(previewUrl);

        return {
          id: crypto.randomUUID(),
          file,
          previewUrl,
          status: "queued",
          progress: 0,
          attempt: 0,
        };
      });

      dispatch({ type: "enqueue", items });
      setValidationErrors(newErrors);
    },
    onDropRejected: (rejections) => {
      const messages = rejections.flatMap((rejection) =>
        rejection.errors.map((error) => `${rejection.file.name}: ${error.message}`),
      );
      setValidationErrors(messages);
    },
  });

  const activeUploads = useMemo(
    () => queue.filter((item) => item.status === "uploading").length,
    [queue],
  );

  const pendingUploads = useMemo(
    () => queue.filter((item) => item.status === "queued" || item.status === "pending").length,
    [queue],
  );

  const queueStats = useMemo(() => {
    const failed = queue.filter((item) => item.status === "error").length;
    const completed = queue.filter((item) => item.status === "success").length;
    return { failed, completed };
  }, [queue]);

  const tagList = useMemo(
    () =>
      tagInput
        .split(",")
        .map((value) => value.trim())
        .filter((value) => value.length > 0),
    [tagInput],
  );

  const startUpload = useCallback(
    async (item: UploadQueueItem) => {
      const controller = new AbortController();
      controllers.current.set(item.id, controller);

      const payload: MediaUploadPayload = {
        folder,
        tags: tagList,
        visibility,
      };

      dispatch({
        type: "update",
        id: item.id,
        patch: { status: "uploading", progress: 5, attempt: item.attempt + 1 },
      });

      const optimisticAsset = createPlaceholderAsset(item, payload);
      onOptimisticAsset?.(optimisticAsset, item.id);

      try {
        const result = await mediaUpload.upload({
          file: item.file,
          payload,
          signal: controller.signal,
          onProgress: (progress) => dispatch({ type: "update", id: item.id, patch: { progress } }),
        });

        dispatch({
          type: "update",
          id: item.id,
          patch: { status: "success", progress: 100, asset: result },
        });

        onOptimisticRevert?.(item.id, result);
        onUploadSuccess?.(result, { placeholderId: item.id });
      } catch (error) {
        if (controller.signal.aborted) {
          dispatch({ type: "update", id: item.id, patch: { status: "canceled", progress: 0 } });
          onOptimisticRevert?.(item.id);
          return;
        }

        const err = error instanceof Error ? error : new Error("Upload failed");
        dispatch({ type: "update", id: item.id, patch: { status: "error", error: err.message } });
        onOptimisticRevert?.(item.id);
        onUploadFailure?.(item, err);
      } finally {
        controllers.current.delete(item.id);
      }
    },
    [
      folder,
      tagList,
      visibility,
      mediaUpload,
      onOptimisticAsset,
      onOptimisticRevert,
      onUploadFailure,
      onUploadSuccess,
    ],
  );

  useEffect(() => {
    if (activeUploads >= MAX_CONCURRENT_UPLOADS) {
      return;
    }

    const availableSlots = MAX_CONCURRENT_UPLOADS - activeUploads;
    const candidates = queue.filter((item) => item.status === "queued").slice(0, availableSlots);

    candidates.forEach((item) => {
      startUpload(item);
    });
  }, [queue, activeUploads, startUpload]);

  const cancelUpload = useCallback(
    (item: UploadQueueItem) => {
      const controller = controllers.current.get(item.id);
      controller?.abort();
      onOptimisticRevert?.(item.id);
      dispatch({ type: "update", id: item.id, patch: { status: "canceled" } });
    },
    [onOptimisticRevert],
  );

  const retryUpload = useCallback((item: UploadQueueItem) => {
    dispatch({
      type: "update",
      id: item.id,
      patch: { status: "queued", progress: 0, error: undefined },
    });
  }, []);

  useEffect(() => {
    return () => {
      controllers.current.forEach((controller) => controller.abort());
      previewUrls.current.forEach((url) => URL.revokeObjectURL(url));
      previewUrls.current.clear();
    };
  }, []);

  return (
    <section className={styles.root} aria-label="Media uploader">
      <header className={styles.header}>
        <div>
          <p className={styles.subtitle}>Drag & drop up to 10 files or use the file picker</p>
          <div className={styles.folderRow}>
            <label>
              Target folder
              <select
                value={folder}
                onChange={(event) => setFolder(event.target.value)}
                className={styles.select}
              >
                {(
                  folderOptions ?? [
                    { label: "Products", value: "lumi/products", maxSizeMb: 5 },
                    { label: "Banners", value: "lumi/banners", maxSizeMb: 10 },
                  ]
                ).map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Tags
              <input
                value={tagInput}
                onChange={(event) => setTagInput(event.target.value)}
                placeholder="product:123, hero"
                className={styles.input}
              />
            </label>
          </div>
        </div>
        <div className={styles.queueStatus}>
          <span>Queue: {queue.length}</span>
          <span>
            Active: {activeUploads}/{MAX_CONCURRENT_UPLOADS}
          </span>
          <span>Pending: {pendingUploads}</span>
          <span>Completed: {queueStats.completed}</span>
          <span>Failed: {queueStats.failed}</span>
        </div>
      </header>

      <div {...dropzone.getRootProps({ className: styles.dropzone })}>
        <input {...dropzone.getInputProps()} aria-label="Select media files" />
        <p>Drop files here or click to browse</p>
        <small>Allowed: JPEG, PNG, WebP, GIF</small>
        <small>
          Max size: {(getMaxSizeForFolder(folder, folderOptions) / (1024 * 1024)).toFixed(1)} MB
        </small>
      </div>

      {validationErrors.length > 0 && (
        <ul className={styles.validationErrors}>
          {validationErrors.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      )}

      {queue.length > 0 && (
        <div className={styles.queueList}>
          {queue.map((item) => (
            <article key={item.id} className={styles.queueItem}>
              <MediaImage
                width={96}
                height={96}
                variant="thumbnail"
                src={item.previewUrl}
                alt={`Preview for ${item.file.name}`}
                className={styles.preview}
              />
              <div className={styles.queueContent}>
                <div className={styles.queueTitleRow}>
                  <div>
                    <p className={styles.filename}>{item.file.name}</p>
                    <small>
                      {formatFileSize(item.file.size)} · Attempt{" "}
                      {item.attempt > 0 ? item.attempt : 1}
                    </small>
                  </div>
                  <div className={styles.actions}>
                    {(item.status === "uploading" || item.status === "queued") && (
                      <button type="button" onClick={() => cancelUpload(item)}>
                        Cancel
                      </button>
                    )}
                    {item.status === "error" && (
                      <button type="button" onClick={() => retryUpload(item)}>
                        Retry
                      </button>
                    )}
                  </div>
                </div>
                <div className={styles.progressBar}>
                  <span style={{ width: `${item.progress}%` }} />
                </div>
                <p className={styles.status} data-status={item.status}>
                  {item.status === "uploading" && `Uploading… ${Math.round(item.progress)}%`}
                  {item.status === "success" && "Upload complete"}
                  {item.status === "error" && item.error}
                  {item.status === "canceled" && "Upload canceled"}
                  {item.status === "queued" && "Waiting for available slot"}
                </p>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
