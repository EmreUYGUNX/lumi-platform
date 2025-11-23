/* istanbul ignore file */
import { sessionStore } from "@/store/session";

// In a real integration this would call a backend endpoint that returns
// feature flags for the current user/tenant. Here we provide a placeholder
// to keep the orchestration flow wired end-to-end.
export const fetchFeatureFlags = async (): Promise<Record<string, boolean>> => {
  // Simulated network delay + static flags for now
  await new Promise<void>((resolve) => {
    setTimeout(() => resolve(), 50);
  });

  return {
    "experience.garage": true,
    "dashboard.commandPalette": true,
    "auth.magicLink": true,
  };
};

export const hydrateFeatureFlags = async (): Promise<void> => {
  const flags = await fetchFeatureFlags();
  sessionStore.getState().setFeatureFlags(flags);
};

export const useFeatureFlag = (flag: string): boolean =>
  sessionStore((state) => {
    // eslint-disable-next-line security/detect-object-injection
    return Boolean(state.featureFlags?.[flag]);
  });
