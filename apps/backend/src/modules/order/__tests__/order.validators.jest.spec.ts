import { describe, expect, it } from "@jest/globals";

import {
  adminOrderListQuerySchema,
  orderRefundSchema,
  orderStatsQuerySchema,
} from "../order.validators.js";

describe("order validators", () => {
  it("applies defaults for admin order list queries", () => {
    const parsed = adminOrderListQuerySchema.parse({ page: "1", pageSize: "25" });

    expect(parsed.format).toBe("json");
    expect(parsed.includeStats).toBe(true);
  });

  it("rejects admin queries when minTotal exceeds maxTotal", () => {
    expect(() =>
      adminOrderListQuerySchema.parse({
        page: "1",
        pageSize: "25",
        minTotal: "100",
        maxTotal: "50",
      }),
    ).toThrow(/minTotal cannot exceed maxTotal/);
  });

  it("defaults refund and stats payload fields", () => {
    const refund = orderRefundSchema.parse({});
    expect(refund.type).toBe("full");

    const stats = orderStatsQuerySchema.parse({});
    expect(stats.range).toBe("30d");
  });
});
