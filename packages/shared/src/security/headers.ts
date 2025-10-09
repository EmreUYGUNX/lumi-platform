import type { SecurityHeadersConfig } from "@lumi/types";

export type SecurityHeaderEntry = [string, string];

const buildStrictTransportSecurity = (
  config: SecurityHeadersConfig["strictTransportSecurity"],
): string => {
  const directives = [`max-age=${config.maxAgeSeconds}`];

  if (config.includeSubDomains) {
    directives.push("includeSubDomains");
  }

  if (config.preload) {
    directives.push("preload");
  }

  return directives.join("; ");
};

const buildExpectCt = (config: SecurityHeadersConfig["expectCt"]): string | undefined => {
  if (!config.enforce && config.maxAgeSeconds === 0 && !config.reportUri) {
    return undefined;
  }

  const directives = [`max-age=${config.maxAgeSeconds}`];

  if (config.enforce) {
    directives.push("enforce");
  }

  if (config.reportUri) {
    directives.push(`report-uri=${config.reportUri}`);
  }

  return directives.join(", ");
};

export const buildSecurityHeaders = (config: SecurityHeadersConfig): SecurityHeaderEntry[] => {
  if (!config.enabled) {
    return [];
  }

  const headers: SecurityHeaderEntry[] = [
    ["Content-Security-Policy", config.contentSecurityPolicy],
    ["Referrer-Policy", config.referrerPolicy],
    ["X-Frame-Options", config.frameGuard],
    ["Permissions-Policy", config.permissionsPolicy],
    ["Strict-Transport-Security", buildStrictTransportSecurity(config.strictTransportSecurity)],
    ["Cross-Origin-Embedder-Policy", config.crossOriginEmbedderPolicy],
    ["Cross-Origin-Opener-Policy", config.crossOriginOpenerPolicy],
    ["Cross-Origin-Resource-Policy", config.crossOriginResourcePolicy],
    ["X-Content-Type-Options", config.xContentTypeOptions],
  ];

  const expectCt = buildExpectCt(config.expectCt);
  if (expectCt) {
    headers.push(["Expect-CT", expectCt]);
  }

  return headers;
};

export const buildSecurityHeadersRecord = (config: SecurityHeadersConfig): Record<string, string> =>
  Object.fromEntries(buildSecurityHeaders(config));
