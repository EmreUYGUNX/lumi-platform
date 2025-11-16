"use client";

const METRIC_ENDPOINT = "/api/v1/media/metrics/lcp";

let observerStarted = false;
let pendingEntry: PerformanceEntry | undefined;

const sendMetric = (value: number) => {
  if (typeof navigator === "undefined") {
    return;
  }

  const payload = {
    value: Math.round(value),
    route: typeof window === "undefined" ? undefined : window.location.pathname,
    viewport:
      typeof window === "undefined" ? undefined : `${window.innerWidth}x${window.innerHeight}`,
  };
  const body = JSON.stringify(payload);

  if (typeof navigator.sendBeacon === "function") {
    const blob = new Blob([body], { type: "application/json" });
    navigator.sendBeacon(METRIC_ENDPOINT, blob);
    return;
  }

  fetch(METRIC_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body,
    keepalive: true,
  }).catch(() => {
    // Errors from telemetry ingestion should never disrupt the UX.
  });
};

const flushPendingEntry = () => {
  if (!pendingEntry) {
    return;
  }
  sendMetric(pendingEntry.startTime);
  pendingEntry = undefined;
};

const registerLcpObserver = () => {
  if (observerStarted || typeof PerformanceObserver === "undefined") {
    return;
  }

  observerStarted = true;
  const observer = new PerformanceObserver((entryList) => {
    const entries = entryList.getEntries();
    const last = entries.at(-1);
    if (last) {
      pendingEntry = last;
    }
  });

  try {
    observer.observe({ type: "largest-contentful-paint", buffered: true });
  } catch {
    observer.disconnect();
    return;
  }

  const finalize = () => {
    flushPendingEntry();
    observer.disconnect();
  };

  window.addEventListener("pagehide", finalize, { once: true });
  document.addEventListener(
    "visibilitychange",
    () => {
      if (document.visibilityState === "hidden") {
        finalize();
      }
    },
    { once: true },
  );
};

export const initMediaPerformanceTelemetry = () => {
  if (typeof window === "undefined") {
    return;
  }

  registerLcpObserver();
};
