import { normalizeCorsConfig } from "@lumi/shared";
import type { ApplicationConfig } from "@lumi/types";

export interface BackendCorsOptions {
  enabled: boolean;
  origin: string[];
  methods: string[];
  allowedHeaders: string[];
  exposedHeaders: string[];
  credentials: boolean;
  maxAge: number;
  unsafeWildcardDetected: boolean;
}

export const buildCorsOptions = (
  config: ApplicationConfig["security"]["cors"],
): BackendCorsOptions => {
  const normalised = normalizeCorsConfig(config);
  const unsafeWildcardDetected = config.allowedOrigins.some((origin) => origin.trim() === "*");

  return {
    enabled: normalised.enabled,
    origin: normalised.allowedOrigins,
    methods: normalised.allowedMethods,
    allowedHeaders: normalised.allowedHeaders,
    exposedHeaders: normalised.exposedHeaders,
    credentials: normalised.allowCredentials,
    maxAge: normalised.maxAgeSeconds,
    unsafeWildcardDetected,
  };
};
