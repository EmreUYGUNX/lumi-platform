import type { NextWebVitalsMetric } from "next/app";

import { handleWebVitals } from "@/lib/analytics/web-vitals";

export const reportWebVitals = (metric: NextWebVitalsMetric): void => {
  handleWebVitals(metric);
};
