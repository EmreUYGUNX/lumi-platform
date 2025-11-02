import type { MoneyDTO } from "@lumi/shared/dto";
import type { EmailConfig } from "@lumi/types";

export type EmailTemplateId =
  | "auth.welcome"
  | "auth.verify-email"
  | "auth.password-reset"
  | "auth.password-changed"
  | "auth.account-locked"
  | "auth.new-device"
  | "auth.session-revoked"
  | "auth.two-factor-setup"
  | "commerce.cart-recovery";

export interface EmailContent {
  subject: string;
  html: string;
  text: string;
  previewText?: string;
  templateId: EmailTemplateId;
}

export interface EmailBrandContext {
  productName: string;
  supportEmail: string;
  supportUrl?: string;
}

export interface EmailTemplateContext {
  brand: EmailBrandContext;
  baseUrl: string;
  locale: string;
}

export interface EmailTemplatePayloads {
  "auth.welcome": {
    firstName?: string | null;
    verificationUrl?: string;
    expiresAt?: Date;
  };
  "auth.verify-email": {
    firstName?: string | null;
    verificationUrl: string;
    expiresAt: Date;
  };
  "auth.password-reset": {
    firstName?: string | null;
    resetUrl: string;
    expiresAt: Date;
  };
  "auth.password-changed": {
    firstName?: string | null;
    changedAt: Date;
    ipAddress?: string | null;
  };
  "auth.account-locked": {
    firstName?: string | null;
    unlockAt: Date;
    ipAddress?: string | null;
    failedAttempts?: number;
  };
  "auth.new-device": {
    firstName?: string | null;
    deviceSummary: string;
    time: Date;
    location?: string | null;
    ipAddress?: string | null;
    userAgent?: string | null;
  };
  "auth.session-revoked": {
    firstName?: string | null;
    revokedAt: Date;
    reason?: string | null;
    ipAddress?: string | null;
  };
  "auth.two-factor-setup": {
    firstName?: string | null;
    setupUrl: string;
    backupCodesUrl?: string;
  };
  "commerce.cart-recovery": {
    firstName?: string | null;
    cartId: string;
    resumeUrl: string;
    itemCount: number;
    total: MoneyDTO;
  };
}

export type EmailTemplatePayload<TTemplateId extends EmailTemplateId> =
  EmailTemplatePayloads[TTemplateId];

export interface EmailTemplateDefinition<TTemplateId extends EmailTemplateId> {
  id: TTemplateId;
  render: (
    payload: EmailTemplatePayloads[TTemplateId],
    context: EmailTemplateContext,
  ) => Omit<EmailContent, "templateId">;
}

export interface RenderEmailTemplateOptions<TTemplateId extends EmailTemplateId> {
  id: TTemplateId;
  payload: EmailTemplatePayload<TTemplateId>;
  context: EmailTemplateContext;
}

export interface EmailTemplateRegistry {
  list(): EmailTemplateId[];
  render<TTemplateId extends EmailTemplateId>(
    id: TTemplateId,
    payload: EmailTemplatePayload<TTemplateId>,
    context: EmailTemplateContext,
  ): EmailContent;
}

export type CartRecoveryEmailPayload = EmailTemplatePayload<"commerce.cart-recovery"> & {
  to: string;
};

export const buildTemplateContext = (config: EmailConfig): EmailTemplateContext => ({
  brand: {
    productName: config.template.branding.productName,
    supportEmail: config.template.branding.supportEmail,
    supportUrl: config.template.branding.supportUrl,
  },
  baseUrl: config.template.baseUrl,
  locale: config.template.defaultLocale,
});
