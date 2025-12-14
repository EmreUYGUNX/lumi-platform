"use client";

import { useCallback, useMemo, useState } from "react";

import type * as fabric from "fabric";
import { CheckCircle2, Image as ImageIcon, UploadCloud, XCircle } from "lucide-react";
import { useDropzone } from "react-dropzone";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

import { useDesignUpload } from "../../hooks/useDesignUpload";
import type { CustomerDesignView } from "../../types/design.types";
import { addCustomerDesignToCanvas } from "../../utils/canvas-assets";

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

type CompressionPreset = "default" | "mobile";

const COMPRESSION_PRESETS: Record<
  CompressionPreset,
  { thresholdBytes: number; maxDimensionPx: number; jpegQuality: number }
> = {
  default: {
    thresholdBytes: 2 * 1024 * 1024,
    maxDimensionPx: 2048,
    jpegQuality: 0.86,
  },
  mobile: {
    thresholdBytes: 512 * 1024,
    maxDimensionPx: 1536,
    jpegQuality: 0.8,
  },
};

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/svg+xml"] as const;

const formatBytes = (bytes: number): string => {
  if (!Number.isFinite(bytes)) return "0 B";
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
};

const isAllowedMime = (mimeType: string): mimeType is (typeof ALLOWED_MIME_TYPES)[number] =>
  (ALLOWED_MIME_TYPES as readonly string[]).includes(mimeType);

const compressIfNeeded = async (file: File, preset: CompressionPreset): Promise<File> => {
  const config = COMPRESSION_PRESETS[preset];
  if (file.size <= config.thresholdBytes) return file;
  if (file.type === "image/svg+xml") return file;

  if (typeof createImageBitmap !== "function") {
    return file;
  }

  const bitmap = await createImageBitmap(file);
  const maxDimension = Math.max(bitmap.width, bitmap.height);
  const scale = maxDimension > 0 ? Math.min(1, config.maxDimensionPx / maxDimension) : 1;
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) return file;

  ctx.drawImage(bitmap, 0, 0, width, height);

  const outputType = file.type === "image/png" ? "image/png" : "image/jpeg";
  const outputQuality = outputType === "image/jpeg" ? config.jpegQuality : undefined;

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, outputType, outputQuality);
  });

  if (!blob) return file;

  const compressed = new File([blob], file.name, {
    type: outputType,
    lastModified: file.lastModified,
  });

  return compressed.size < file.size ? compressed : file;
};

interface ImageUploaderProps {
  canvas?: fabric.Canvas;
  onUploaded?: (design: CustomerDesignView) => void;
  compressionPreset?: CompressionPreset;
  className?: string;
}

export function ImageUploader({
  canvas,
  onUploaded,
  compressionPreset = "default",
  className,
}: ImageUploaderProps): JSX.Element {
  const [error, setError] = useState<string | undefined>();
  const [success, setSuccess] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | undefined>();
  const [isCompressing, setIsCompressing] = useState(false);
  const [progress, setProgress] = useState(0);

  const upload = useDesignUpload();

  const acceptConfig = useMemo(
    () => Object.fromEntries(ALLOWED_MIME_TYPES.map((mime) => [mime, [] as string[]])),
    [],
  );

  const handleUpload = useCallback(
    async (file: File) => {
      setError(undefined);
      setSuccess(false);
      setProgress(1);

      let fileToUpload = file;

      const preset = COMPRESSION_PRESETS[compressionPreset];
      if (file.size > preset.thresholdBytes && file.type !== "image/svg+xml") {
        setIsCompressing(true);
        try {
          fileToUpload = await compressIfNeeded(file, compressionPreset);
        } finally {
          setIsCompressing(false);
        }
      }

      try {
        const result = await upload.upload({
          file: fileToUpload,
          payload: {
            uploadedFrom: "editor",
          },
          onProgress: (next) => {
            setProgress(next);
          },
        });

        setProgress(100);
        setSuccess(true);
        onUploaded?.(result);

        if (canvas) {
          await addCustomerDesignToCanvas({
            canvas,
            design: result,
            layerName: file.name.toUpperCase().slice(0, 32),
          });
        }
      } catch (uploadError) {
        setProgress(0);
        setSuccess(false);
        setError(uploadError instanceof Error ? uploadError.message : "Upload failed.");
      }
    },
    [canvas, onUploaded, upload],
  );

  const dropzone = useDropzone({
    accept: acceptConfig,
    multiple: false,
    maxFiles: 1,
    maxSize: MAX_UPLOAD_BYTES,
    onDropAccepted: async (files) => {
      const [file] = files;
      if (!file) return;

      if (!isAllowedMime(file.type)) {
        setError(`Unsupported file type: ${file.type}`);
        return;
      }

      if (file.size > MAX_UPLOAD_BYTES) {
        setError(`File is too large (${formatBytes(file.size)}). Max is 5MB.`);
        return;
      }

      setSelectedFile(file);
      await handleUpload(file);
    },
    onDropRejected: (rejections) => {
      const rejection = rejections[0];
      if (!rejection) return;
      const message = rejection.errors.map((entry) => entry.message).join(", ");
      setError(message || "Upload rejected.");
    },
    noKeyboard: true,
    noClick: true,
  });

  const isUploading = upload.isPending || isCompressing;
  const isReady = Boolean(canvas);

  return (
    <section
      className={cn(
        "flex flex-col gap-4 rounded-2xl border border-white/10 bg-black/5 p-4 text-white/80",
        className,
      )}
      aria-label="Image upload"
    >
      <header className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ImageIcon className="h-4 w-4 text-white/70" />
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.28em]">Upload</h3>
        </div>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="h-8 gap-2 rounded-xl px-3"
          disabled={isUploading}
          onClick={dropzone.open}
        >
          <UploadCloud className="h-4 w-4" />
          Choose file
        </Button>
      </header>

      <div
        {...dropzone.getRootProps()}
        className={cn(
          "flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed px-5 py-10 text-center transition",
          dropzone.isDragActive ? "border-white/40 bg-white/5" : "border-white/15 bg-black/10",
        )}
      >
        <input {...dropzone.getInputProps()} />
        <UploadCloud className="h-6 w-6 text-white/60" />
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70">
          Drag & drop an image here
        </p>
        <p className="text-[11px] text-white/50">
          JPEG / PNG / SVG · up to 5MB {isReady ? "" : "· canvas not ready"}
        </p>
      </div>

      {selectedFile && (
        <div className="rounded-xl border border-white/10 bg-black/10 px-3 py-2 text-[11px] text-white/60">
          <p className="truncate">
            <span className="text-white/70">File:</span> {selectedFile.name} (
            {formatBytes(selectedFile.size)})
          </p>
          {isCompressing && <p className="mt-1">Optimizing before upload…</p>}
        </div>
      )}

      {isUploading && (
        <div className="space-y-2">
          <Progress value={progress} className="h-2 bg-white/10" />
          <p className="text-[11px] text-white/60">Uploading… {progress}%</p>
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-3 py-2 text-[11px] text-emerald-200">
          <CheckCircle2 className="h-4 w-4" />
          <span>Upload successful. Added to canvas.</span>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-400/20 bg-red-500/10 px-3 py-2 text-[11px] text-red-200">
          <XCircle className="h-4 w-4" />
          <span>{error}</span>
        </div>
      )}

      {!isReady && (
        <p className="text-[11px] text-white/50">
          Canvas is initializing… Try again once the editor is ready.
        </p>
      )}
    </section>
  );
}
