import type { RequestHandler } from "express";
import sanitizeHtml from "sanitize-html";

import { ApiError } from "@/errors/api-error.js";
import { createChildLogger } from "@/lib/logger.js";

const logger = createChildLogger("design:svg-sanitizer");

const SAFE_SVG_TAGS = [
  "svg",
  "g",
  "use",
  "path",
  "rect",
  "circle",
  "ellipse",
  "line",
  "polyline",
  "polygon",
  "text",
  "tspan",
  "defs",
  "clipPath",
  "mask",
  "pattern",
  "linearGradient",
  "radialGradient",
  "stop",
] as const;

const SAFE_SVG_ATTRIBUTES = [
  "id",
  "class",
  "xmlns",
  "xmlns:xlink",
  "version",
  "viewBox",
  "preserveAspectRatio",
  "x",
  "y",
  "x1",
  "y1",
  "x2",
  "y2",
  "width",
  "height",
  "cx",
  "cy",
  "r",
  "rx",
  "ry",
  "d",
  "points",
  "transform",
  "fill",
  "fill-rule",
  "fill-opacity",
  "stroke",
  "stroke-width",
  "stroke-linecap",
  "stroke-linejoin",
  "stroke-miterlimit",
  "stroke-dasharray",
  "stroke-dashoffset",
  "stroke-opacity",
  "opacity",
  "font-family",
  "font-size",
  "font-weight",
  "text-anchor",
  "dominant-baseline",
  "dx",
  "dy",
  "offset",
  "stop-color",
  "stop-opacity",
  "gradientUnits",
  "gradientTransform",
  "spreadMethod",
  "clip-path",
  "mask",
  "style",
  "href",
  "xlink:href",
] as const;

const MAX_SVG_BYTES = 5 * 1024 * 1024;

const isSafeLocalReference = (value: string): boolean => {
  const trimmed = value.trim();
  return trimmed.startsWith("#") && trimmed.length > 1;
};

export const sanitizeSvg = (input: string): string => {
  const trimmed = input.trim();
  if (!trimmed) {
    return "";
  }

  return sanitizeHtml(trimmed, {
    allowedTags: [...SAFE_SVG_TAGS],
    allowedAttributes: {
      "*": [...SAFE_SVG_ATTRIBUTES],
    },
    allowedStyles: {
      "*": {
        fill: [
          /^none$/iu,
          /^#[0-9a-f]{3,8}$/iu,
          /^rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+(?:\s*,\s*(?:0|1|0?\.\d+))?\s*\)$/iu,
          /^url\(#[-_a-z0-9]+\)$/iu,
        ],
        stroke: [
          /^none$/iu,
          /^#[0-9a-f]{3,8}$/iu,
          /^rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+(?:\s*,\s*(?:0|1|0?\.\d+))?\s*\)$/iu,
          /^url\(#[-_a-z0-9]+\)$/iu,
        ],
        "stroke-width": [/^\d+(?:\.\d+)?(?:px)?$/iu],
        opacity: [/^(?:0|1|0?\.\d+)$/u],
        "font-size": [/^\d+(?:\.\d+)?(?:px|pt|em|rem|%)$/iu],
        "font-family": [/^[\w\s"'-]+$/iu],
      },
    },
    transformTags: {
      "*": (tagName, attribs) => {
        const cleaned: Record<string, string> = {};

        Object.entries(attribs).forEach(([key, value]) => {
          const normalizedKey = key.toLowerCase();
          if (normalizedKey.startsWith("on")) {
            return;
          }

          if (normalizedKey === "href" || normalizedKey === "xlink:href") {
            if (typeof value === "string" && isSafeLocalReference(value)) {
              cleaned[key] = value.trim();
            }
            return;
          }

          cleaned[key] = value;
        });

        return { tagName, attribs: cleaned };
      },
    },
    disallowedTagsMode: "discard",
    parser: {
      lowerCaseTags: false,
      lowerCaseAttributeNames: false,
    },
  });
};

const extractUploadFile = (req: Parameters<RequestHandler>[0]): Express.Multer.File | undefined => {
  const candidate = (req as typeof req & { file?: Express.Multer.File }).file;
  if (candidate) {
    return candidate;
  }

  const { files } = req as typeof req & { files?: unknown };
  if (!files) {
    return undefined;
  }

  if (Array.isArray(files)) {
    return files[0] as Express.Multer.File | undefined;
  }

  if (typeof files === "object") {
    const typedFiles = files as Record<string, Express.Multer.File | Express.Multer.File[]>;
    const first = Object.values(typedFiles).flat(Number.POSITIVE_INFINITY).at(0);
    return first as Express.Multer.File | undefined;
  }

  return undefined;
};

export const createSvgSanitizationMiddleware = (): RequestHandler => {
  return (req, _res, next) => {
    const file = extractUploadFile(req);
    if (!file) {
      next();
      return;
    }

    if (file.mimetype !== "image/svg+xml") {
      next();
      return;
    }

    if (file.size > MAX_SVG_BYTES) {
      next(
        new ApiError("SVG upload exceeds maximum size.", {
          status: 413,
          code: "PAYLOAD_TOO_LARGE",
        }),
      );
      return;
    }

    const original = file.buffer.toString("utf8");
    const sanitized = sanitizeSvg(original);

    if (!sanitized) {
      next(
        new ApiError("SVG upload contains no usable content after sanitization.", {
          status: 422,
          code: "INVALID_SVG",
        }),
      );
      return;
    }

    if (sanitized !== original) {
      logger.warn("Sanitized customer SVG upload", {
        userId: req.user?.id,
        originalBytes: Buffer.byteLength(original),
        sanitizedBytes: Buffer.byteLength(sanitized),
      });
    }

    file.buffer = Buffer.from(sanitized, "utf8");
    file.size = file.buffer.length;
    next();
  };
};
