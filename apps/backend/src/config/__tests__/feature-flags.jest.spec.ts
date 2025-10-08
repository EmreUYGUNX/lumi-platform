// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, expect, it, jest } from "@jest/globals";

import { FeatureFlagRegistry, createFeatureFlagRegistry } from "../feature-flags.js";

describe("FeatureFlagRegistry", () => {
  it("defaults to an empty registry when no initial flags are provided", () => {
    const registry = new FeatureFlagRegistry();
    expect(registry.snapshot()).toEqual({});
    expect(registry.isEnabled("missing")).toBe(false);
  });

  it("provides an immutable snapshot", () => {
    const registry = new FeatureFlagRegistry({ beta: true });
    const snapshot = registry.snapshot();

    expect(snapshot).toEqual({ beta: true });

    snapshot.beta = false;
    expect(registry.isEnabled("beta")).toBe(true);
  });

  it("allows querying and updates", () => {
    const registry = createFeatureFlagRegistry({ checkout: false });
    expect(registry.isEnabled("checkout")).toBe(false);
    expect(registry.isEnabled("nonexistent")).toBe(false);

    registry.update({ checkout: true, onboarding: true });
    expect(registry.isEnabled("checkout")).toBe(true);
    expect(registry.isEnabled("onboarding")).toBe(true);
  });

  it("notifies listeners when flags change", () => {
    const registry = new FeatureFlagRegistry({ initial: false });
    const listener = jest.fn();
    const unsubscribe = registry.onChange(listener);

    registry.update({ initial: true });

    expect(listener).toHaveBeenCalledTimes(1);
    const [payload] = listener.mock.calls[0] ?? [];
    expect(payload).toEqual({ initial: true });

    unsubscribe();
    registry.update({ initial: false });
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
