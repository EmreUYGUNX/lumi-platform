import { beforeEach, describe, expect, it } from "vitest";

import { sessionStore, uiStore } from "@/store";

const PREFERENCES_KEY = "lumi.preferences";
const initialSessionSnapshot = sessionStore.getState();
const initialUISnapshot = uiStore.getState();

describe("state management stores", () => {
  beforeEach(() => {
    sessionStore.setState(initialSessionSnapshot, true);
    uiStore.setState(initialUISnapshot, true);
    localStorage.clear();
    sessionStorage.clear();
  });

  it("hydrates preview user when requested", () => {
    expect(sessionStore.getState().user).toBeUndefined();
    sessionStore.getState().hydratePreviewUser();
    const state = sessionStore.getState();
    expect(state.status).toBe("authenticated");
    expect(state.user?.id).toBeDefined();
    expect(state.roles.length).toBeGreaterThan(0);
  });

  it("updates preferences and persists to localStorage", () => {
    sessionStore.getState().updatePreferences({ theme: "dark", locale: "en-US" });
    const persisted = localStorage.getItem(PREFERENCES_KEY);
    expect(persisted).toContain("dark");
    expect(sessionStore.getState().preferences.theme).toBe("dark");
  });

  it("stores feature flags during login", () => {
    sessionStore.getState().login({
      user: {
        id: "user_1",
        name: "Vibe Tester",
        email: "tester@lumi.com",
        roles: ["merchant"],
        tier: "starter",
      },
      accessToken: "token_123",
      featureFlags: { beta_checkout: true },
    });
    const state = sessionStore.getState();
    expect(state.status).toBe("authenticated");
    expect(state.accessToken).toBe("token_123");
    expect(state.featureFlags.beta_checkout).toBe(true);
  });

  it("updates user profile and tokens safely", () => {
    sessionStore.getState().hydratePreviewUser();
    sessionStore.getState().setAuthToken("jwt_token");

    sessionStore.getState().updateUser({ name: "Updated User", roles: ["admin"] });
    const state = sessionStore.getState();
    expect(state.user?.name).toBe("Updated User");
    expect(state.roles).toEqual(["admin"]);
    expect(state.accessToken).toBe("jwt_token");
  });

  it("merges feature flags and toggles individual entries", () => {
    sessionStore.getState().setFeatureFlags({ beta_checkout: true });
    sessionStore.getState().toggleFeatureFlag("beta_checkout", false);

    expect(sessionStore.getState().featureFlags.beta_checkout).toBe(false);
  });

  it("transitions authentication status correctly", () => {
    sessionStore.getState().startAuthentication();
    expect(sessionStore.getState().status).toBe("authenticating");

    sessionStore.getState().logout();
    expect(sessionStore.getState().status).toBe("anonymous");
    expect(sessionStore.getState().user).toBeUndefined();
  });

  it("manages toast queue with an upper bound", () => {
    const enqueue = uiStore.getState().enqueueToast;
    for (let index = 0; index < 8; index += 1) {
      enqueue({
        title: `Toast ${index + 1}`,
        variant: "default",
      });
    }
    expect(uiStore.getState().toastQueue).toHaveLength(5);
  });

  it("tracks loading states for concurrent operations", () => {
    const { startLoading, stopLoading } = uiStore.getState();
    startLoading("products");
    startLoading("cart");
    expect(uiStore.getState().loadingStates.products).toBe(true);
    stopLoading("products");
    expect(uiStore.getState().loadingStates.products).toBeUndefined();
    expect(uiStore.getState().loadingStates.cart).toBe(true);
  });

  it("toggles sidebar and command palette state", () => {
    const ui = uiStore.getState();
    ui.toggleSidebar();
    expect(uiStore.getState().isSidebarOpen).toBe(false);
    ui.setSidebarOpen(true);
    ui.setSidebarPinned(false);
    expect(uiStore.getState().sidebarPinned).toBe(false);

    ui.openCommandPalette();
    expect(uiStore.getState().commandPaletteOpen).toBe(true);
    ui.closeCommandPalette();
    expect(uiStore.getState().commandPaletteOpen).toBe(false);
  });

  it("manages modal stack lifecycle", () => {
    const id = uiStore.getState().pushModal({ id: "m1", context: { flow: "checkout" } });
    uiStore.getState().pushModal({ id: "m2" });
    expect(uiStore.getState().modalStack).toHaveLength(2);

    uiStore.getState().dismissModal(id);
    expect(uiStore.getState().modalStack.some((modal) => modal.id === "m1")).toBe(false);

    uiStore.getState().popModal();
    expect(uiStore.getState().modalStack).toHaveLength(0);

    uiStore.getState().pushModal({ id: "m3" });
    uiStore.getState().resetModals();
    expect(uiStore.getState().modalStack).toHaveLength(0);
  });

  it("dismisses and resets toasts explicitly", () => {
    const firstId = uiStore
      .getState()
      .enqueueToast({ id: "toast-a", title: "First", variant: "default" });
    uiStore.getState().enqueueToast({ title: "Second", variant: "success" });

    uiStore.getState().dismissToast(firstId);
    expect(uiStore.getState().toastQueue.some((toast) => toast.id === firstId)).toBe(false);

    uiStore.getState().resetToasts();
    expect(uiStore.getState().toastQueue).toHaveLength(0);
  });
});
