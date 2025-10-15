export const sharedConstants = {
  projectName: "Lumi",
};

export const isProduction = () => process.env.NODE_ENV === "production";

export { normalizeCorsConfig, isOriginAllowed } from "./security/cors.js";
export {
  buildSecurityHeaders,
  buildSecurityHeadersRecord,
  type SecurityHeaderEntry,
} from "./security/headers.js";
export {
  createValidator,
  sanitizeValue,
  validatePayload,
  type ValidationFailure,
  type ValidationResult,
  type ValidationSuccess,
} from "./validation/index.js";

export * from "./dto/index.js";
