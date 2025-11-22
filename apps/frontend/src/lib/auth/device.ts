/* eslint-disable no-console */
/* eslint-disable unicorn/no-null */
import { sessionStore, type TrustedDevice } from "@/store/session";

interface DeviceSignals {
  userAgent?: string;
  screen?: string;
  language?: string;
  timeZone?: string;
  platform?: string;
  hardwareConcurrency?: number;
  colorDepth?: number;
  canvas?: string;
}

const isBrowser = typeof window !== "undefined";

const safeNavigator = (): Navigator | undefined => (isBrowser ? window.navigator : undefined);

const getCanvasFingerprint = (): string | undefined => {
  if (!isBrowser || process.env.NODE_ENV === "test") return undefined;
  try {
    const canvas = document.createElement("canvas");
    if (typeof canvas.getContext !== "function") return undefined;
    const context = canvas.getContext("2d");
    if (!context) return undefined;
    context.textBaseline = "top";
    context.font = "14px 'Arial'";
    context.fillStyle = "#f60";
    context.fillRect(125, 1, 62, 20);
    context.fillStyle = "#069";
    context.fillText("lumi-fingerprint", 2, 15);
    return canvas.toDataURL();
  } catch {
    return undefined;
  }
};

export const collectDeviceSignals = (): DeviceSignals => {
  const nav = safeNavigator();

  return {
    userAgent: nav?.userAgent,
    language: nav?.language,
    platform: nav?.platform,
    timeZone: (() => {
      let zone: string | undefined;
      try {
        zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      } catch (error) {
        console.warn("[device] unable to resolve timezone", error);
      }
      return zone;
    })(),
    screen:
      isBrowser && window.screen
        ? `${window.screen.width}x${window.screen.height}@${window.devicePixelRatio ?? 1}`
        : undefined,
    hardwareConcurrency: nav?.hardwareConcurrency,
    colorDepth: isBrowser ? window.screen.colorDepth : undefined,
    canvas: getCanvasFingerprint(),
  };
};

const HASH_MODULUS = 1e9 + 7;

const hashString = async (value: string): Promise<string> => {
  if (isBrowser && window.crypto?.subtle) {
    const encoder = new TextEncoder();
    const data = encoder.encode(value);
    const digest = await window.crypto.subtle.digest("SHA-256", data);
    return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  }

  // Fallback non-crypto hash (dev/test environments)
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    const codePoint = value.codePointAt(index) ?? 0;
    hash = Math.imul(hash, 31) + codePoint;
    hash %= HASH_MODULUS;
    if (codePoint > 65_535) {
      index += 1;
    }
  }
  return `fallback-${Math.abs(hash)}`;
};

export const generateDeviceFingerprint = async (): Promise<string> => {
  const signals = collectDeviceSignals();
  const payload = JSON.stringify(signals);
  return hashString(payload);
};

export const ensureDeviceFingerprint = async (): Promise<string | null> => {
  const current = sessionStore.getState().deviceFingerprint;
  if (current) {
    return current;
  }
  try {
    const fingerprint = await generateDeviceFingerprint();
    sessionStore.getState().setDeviceFingerprint(fingerprint);
    return fingerprint;
  } catch (error) {
    console.warn("[device] fingerprint generation failed", error);
    return null;
  }
};

export const registerTrustedDevice = async (
  label = "This device",
): Promise<TrustedDevice | null> => {
  const fingerprint = await ensureDeviceFingerprint();
  if (!fingerprint) {
    return null;
  }

  const signals = collectDeviceSignals();
  const device: TrustedDevice = {
    id: fingerprint,
    label,
    lastUsedAt: new Date().toISOString(),
    platform: signals.platform,
    userAgent: signals.userAgent,
    trusted: true,
  };

  sessionStore.getState().addTrustedDevice(device);
  return device;
};
