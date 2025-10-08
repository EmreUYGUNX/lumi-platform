import { TextDecoder, TextEncoder } from "node:util";

if (globalThis.TextEncoder === undefined) {
  globalThis.TextEncoder = TextEncoder as typeof globalThis.TextEncoder;
}

if (globalThis.TextDecoder === undefined) {
  globalThis.TextDecoder = TextDecoder as typeof globalThis.TextDecoder;
}
