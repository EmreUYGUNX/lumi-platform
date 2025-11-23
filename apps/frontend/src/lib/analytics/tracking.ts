export type AnalyticsEventPayload = Record<string, unknown>;

export function trackClientEvent(event: string, payload: AnalyticsEventPayload = {}): void {
  if (typeof window === "undefined") return;

  // Placeholder tracker: replace with PostHog/GA when available
  window.dispatchEvent(
    new CustomEvent("lumi:analytics", {
      detail: { event, payload, timestamp: Date.now() },
    }),
  );
}
