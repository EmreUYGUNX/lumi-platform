// Ensure `self` exists in Node (e.g., Node 18 on CI) before Next.js bundles run.
if (typeof globalThis.self === "undefined") {
  globalThis.self = globalThis;
}
