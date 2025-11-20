import { TextDecoder, TextEncoder } from "node:util";

if (globalThis.TextEncoder === undefined) {
  globalThis.TextEncoder = TextEncoder as typeof globalThis.TextEncoder;
}

if (globalThis.TextDecoder === undefined) {
  globalThis.TextDecoder = TextDecoder as typeof globalThis.TextDecoder;
}

if (globalThis.ResizeObserver === undefined) {
  class ResizeObserver {
    private readonly callback: ResizeObserverCallback;

    constructor(callback: ResizeObserverCallback) {
      this.callback = callback;
    }

    observe(target: Element): void {
      this.callback(
        [{ target, contentRect: target.getBoundingClientRect() } as ResizeObserverEntry],
        this,
      );
    }

    unobserve(): void {
      // call callback with empty payload so lint rules remain satisfied
      this.callback([] as ResizeObserverEntry[], this as unknown as ResizeObserver);
    }

    disconnect(): void {
      this.callback([] as ResizeObserverEntry[], this as unknown as ResizeObserver);
    }
  }

  globalThis.ResizeObserver = ResizeObserver as typeof globalThis.ResizeObserver;
}
