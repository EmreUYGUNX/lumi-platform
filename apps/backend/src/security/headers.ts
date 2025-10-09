import { buildSecurityHeaders, buildSecurityHeadersRecord } from "@lumi/shared";
import type { ApplicationConfig } from "@lumi/types";

export type HttpHeader = [string, string];

export const resolveSecurityHeaders = (
  config: ApplicationConfig["security"]["headers"],
): HttpHeader[] => buildSecurityHeaders(config);

export const resolveSecurityHeaderMap = (
  config: ApplicationConfig["security"]["headers"],
): Record<string, string> => buildSecurityHeadersRecord(config);
