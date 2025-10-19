import { createHmac } from "node:crypto";

export interface FingerprintComponents {
  ipAddress?: string | null;
  userAgent?: string | null;
  accept?: string | null;
}

const normaliseComponent = (value?: string | null): string => {
  if (!value) {
    return "unknown";
  }

  return value.trim().toLowerCase();
};

export const createFingerprintPayload = ({
  ipAddress,
  userAgent,
  accept,
}: FingerprintComponents): string => {
  const parts: string[] = [
    normaliseComponent(ipAddress),
    normaliseComponent(userAgent),
    normaliseComponent(accept),
  ];

  return parts.join("|");
};

export interface CreateDeviceFingerprintInput extends FingerprintComponents {
  secret: string;
}

export const createDeviceFingerprint = ({
  secret,
  ...components
}: CreateDeviceFingerprintInput): string => {
  const payload = createFingerprintPayload(components);

  return createHmac("sha256", secret).update(payload).digest("base64url");
};
