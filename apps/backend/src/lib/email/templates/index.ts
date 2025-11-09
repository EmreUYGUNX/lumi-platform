import type {
  EmailContent,
  EmailTemplateContext,
  EmailTemplateDefinition,
  EmailTemplateId,
  EmailTemplatePayload,
  EmailTemplatePayloads,
} from "../types.js";
import { accountLockedTemplate } from "./account-locked.template.js";
import { cartRecoveryTemplate } from "./cart-recovery.template.js";
import { newDeviceTemplate } from "./new-device.template.js";
import { orderConfirmationTemplate } from "./order-confirmation.template.js";
import { passwordChangedTemplate } from "./password-changed.template.js";
import { passwordResetTemplate } from "./password-reset.template.js";
import { sessionRevokedTemplate } from "./session-revoked.template.js";
import { twoFactorSetupTemplate } from "./two-factor-setup.template.js";
import { verifyEmailTemplate } from "./verify-email.template.js";
import { welcomeTemplate } from "./welcome.template.js";

const templateMap: Record<EmailTemplateId, EmailTemplateDefinition<EmailTemplateId>> = {
  "auth.welcome": welcomeTemplate as EmailTemplateDefinition<EmailTemplateId>,
  "auth.verify-email": verifyEmailTemplate as EmailTemplateDefinition<EmailTemplateId>,
  "auth.password-reset": passwordResetTemplate as EmailTemplateDefinition<EmailTemplateId>,
  "auth.password-changed": passwordChangedTemplate as EmailTemplateDefinition<EmailTemplateId>,
  "auth.account-locked": accountLockedTemplate as EmailTemplateDefinition<EmailTemplateId>,
  "auth.new-device": newDeviceTemplate as EmailTemplateDefinition<EmailTemplateId>,
  "auth.session-revoked": sessionRevokedTemplate as EmailTemplateDefinition<EmailTemplateId>,
  "auth.two-factor-setup": twoFactorSetupTemplate as EmailTemplateDefinition<EmailTemplateId>,
  "commerce.cart-recovery": cartRecoveryTemplate as EmailTemplateDefinition<EmailTemplateId>,
  "commerce.order-confirmation":
    orderConfirmationTemplate as EmailTemplateDefinition<EmailTemplateId>,
};

export const listEmailTemplates = (): EmailTemplateId[] =>
  Object.keys(templateMap) as EmailTemplateId[];

const getTemplateOrThrow = <TTemplateId extends EmailTemplateId>(
  id: TTemplateId,
): EmailTemplateDefinition<TTemplateId> => {
  // eslint-disable-next-line security/detect-object-injection -- 'id' is a controlled enum key
  const template = templateMap[id];

  if (!template) {
    throw new Error(`Email template '${id}' is not registered.`);
  }

  return template as unknown as EmailTemplateDefinition<TTemplateId>;
};

export const renderEmailTemplate = <TTemplateId extends EmailTemplateId>(
  id: TTemplateId,
  payload: EmailTemplatePayload<TTemplateId>,
  context: EmailTemplateContext,
): EmailContent => {
  const template = getTemplateOrThrow(id);

  const rendered = template.render(payload as EmailTemplatePayloads[TTemplateId], context);

  return {
    ...rendered,
    templateId: id,
  };
};

export const getEmailTemplate = <TTemplateId extends EmailTemplateId>(
  id: TTemplateId,
): EmailTemplateDefinition<TTemplateId> => getTemplateOrThrow(id);
