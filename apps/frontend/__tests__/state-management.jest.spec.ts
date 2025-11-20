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
});
