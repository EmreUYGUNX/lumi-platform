import { describe, expect, it } from "@jest/globals";

import { OrderService } from "../order.service.js";

interface OrderServiceHelperAccess {
  sanitiseShipmentMetadata(metadata: unknown): Record<string, unknown> | undefined;
  sanitiseMetadata(metadata: unknown): Record<string, unknown>;
  stripInternalMetadata<T extends { metadata?: unknown }>(order: T): T;
  mergeShipmentMetadata(
    metadata: Record<string, unknown>,
    updates: Partial<Record<string, unknown>>,
  ): Record<string, unknown>;
}

const helpers = OrderService as unknown as OrderServiceHelperAccess;

describe("OrderService helper utilities", () => {
  it("coerces shipment metadata and tolerates invalid inputs", () => {
    const invalidInput: unknown = undefined;
    expect(helpers.sanitiseShipmentMetadata(invalidInput)).toBeUndefined();

    const metadata = helpers.sanitiseShipmentMetadata({
      trackingNumber: "  LK-123  ",
      trackingUrl: "https://tracking.example.com/123 ",
      carrier: "  Lumi Express ",
      estimatedDelivery: "2024-01-01T10:15:00Z",
    });

    expect(metadata).toMatchObject({
      trackingNumber: "LK-123",
      trackingUrl: "https://tracking.example.com/123",
      carrier: "Lumi Express",
      estimatedDelivery: "2024-01-01T10:15:00.000Z",
    });

    const invalidDate = helpers.sanitiseShipmentMetadata({
      trackingNumber: "LK-999",
      estimatedDelivery: "not-a-date",
    });

    expect(invalidDate).toMatchObject({
      trackingNumber: "LK-999",
    });
    expect(invalidDate?.estimatedDelivery).toBeNull();
  });

  it("normalises order metadata and prunes unsupported structures", () => {
    const metadata = helpers.sanitiseMetadata({
      shipment: {
        trackingNumber: "ZZ-42",
        // eslint-disable-next-line unicorn/no-null -- explicit null inputs should be removed
        trackingUrl: null,
      },
      internalNotes: { message: "should be ignored" },
      extras: "value",
    });

    expect(metadata).toMatchObject({
      shipment: {
        trackingNumber: "ZZ-42",
      },
      extras: "value",
    });
    expect("internalNotes" in metadata).toBe(false);
  });

  it("strips internal metadata while preserving other properties", () => {
    const order = helpers.stripInternalMetadata({
      id: "order-1",
      metadata: {
        internalNotes: [{ id: "note-1" }],
        shipment: { trackingNumber: "AA-1" },
      },
    });

    expect(order.metadata).toEqual({
      shipment: { trackingNumber: "AA-1" },
    });

    const cleaned = helpers.stripInternalMetadata({
      id: "order-2",
      metadata: {
        internalNotes: [{ id: "note-1" }],
      },
    });

    // eslint-disable-next-line unicorn/no-null -- helper intentionally normalises to null when metadata is empty
    expect(cleaned.metadata).toBeNull();
  });

  it("merges shipment metadata updates without discarding existing values", () => {
    const merged = helpers.mergeShipmentMetadata(
      {
        shipment: {
          trackingNumber: "AA-1",
          carrier: "Lumi",
        },
      },
      {
        carrier: "Lumi Express",
        estimatedDelivery: "2024-02-01T00:00:00Z",
      },
    );

    expect(merged.shipment).toMatchObject({
      trackingNumber: "AA-1",
      carrier: "Lumi Express",
      estimatedDelivery: "2024-02-01T00:00:00Z",
    });
  });
});
