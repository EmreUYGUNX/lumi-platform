import type { CorsConfig } from "@lumi/types";

const unique = <T>(values: T[]): T[] => [...new Set(values)];

const normaliseHeader = (header: string) => header.trim().toLowerCase();
const normaliseMethod = (method: string) => method.trim().toUpperCase();
const normaliseOrigin = (origin: string) => origin.trim();

export interface NormalizedCorsConfig extends CorsConfig {
  allowedOrigins: string[];
  allowedMethods: string[];
  allowedHeaders: string[];
  exposedHeaders: string[];
}

export const normalizeCorsConfig = (config: CorsConfig): NormalizedCorsConfig => ({
  ...config,
  allowedOrigins: unique(config.allowedOrigins.map((origin) => normaliseOrigin(origin))).filter(
    (value) => value.length > 0,
  ),
  allowedMethods: unique(config.allowedMethods.map((method) => normaliseMethod(method))).filter(
    (value) => value.length > 0,
  ),
  allowedHeaders: unique(config.allowedHeaders.map((header) => normaliseHeader(header))).filter(
    (value) => value.length > 0,
  ),
  exposedHeaders: unique(config.exposedHeaders.map((header) => normaliseHeader(header))).filter(
    (value) => value.length > 0,
  ),
});

export const isOriginAllowed = (origin: string | undefined, config: CorsConfig): boolean => {
  const normalised = normalizeCorsConfig(config);

  if (!normalised.enabled || !origin) {
    return true;
  }

  if (normalised.allowedOrigins.includes("*")) {
    return true;
  }

  return normalised.allowedOrigins.includes(normaliseOrigin(origin));
};
