import { EventEmitter } from "node:events";

import type { FeatureFlagMap } from "@lumi/types";

type FeatureFlagListener = (flags: FeatureFlagMap) => void;

export class FeatureFlagRegistry {
  #flags: FeatureFlagMap;

  #emitter = new EventEmitter();

  constructor(initialFlags: FeatureFlagMap = {}) {
    this.#flags = { ...initialFlags };
  }

  snapshot(): FeatureFlagMap {
    return { ...this.#flags };
  }

  isEnabled(flag: string): boolean {
    if (!Object.prototype.hasOwnProperty.call(this.#flags, flag)) {
      return false;
    }

    // eslint-disable-next-line security/detect-object-injection
    return Boolean(this.#flags[flag]);
  }

  update(flags: FeatureFlagMap): void {
    this.#flags = { ...flags };
    this.#emitter.emit("change", this.snapshot());
  }

  onChange(listener: FeatureFlagListener): () => void {
    this.#emitter.on("change", listener);
    return () => this.#emitter.off("change", listener);
  }
}

export const createFeatureFlagRegistry = (flags: FeatureFlagMap = {}): FeatureFlagRegistry =>
  new FeatureFlagRegistry(flags);
