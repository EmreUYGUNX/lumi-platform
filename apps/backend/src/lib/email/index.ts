export { createSignedUrl, verifySignedUrl } from "./signed-url.js";
export { getEmailTemplate, listEmailTemplates, renderEmailTemplate } from "./templates/index.js";
export { buildTemplateContext } from "./types.js";
export type {
  EmailBrandContext,
  EmailContent,
  EmailTemplateContext,
  EmailTemplateDefinition,
  EmailTemplateId,
  EmailTemplatePayload,
  EmailTemplatePayloads,
  EmailTemplateRegistry,
} from "./types.js";
