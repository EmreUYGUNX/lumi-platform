import { describe, expect, it, jest } from "@jest/globals";

import { traceOrderOperation } from "../order-tracing.js";
import { getSentryInstance, isSentryEnabled } from "../sentry.js";

jest.mock("../sentry.js", () => ({
  isSentryEnabled: jest.fn(),
  getSentryInstance: jest.fn(),
}));

const isSentryEnabledMock = isSentryEnabled as jest.MockedFunction<typeof isSentryEnabled>;
const getSentryInstanceMock = getSentryInstance as jest.MockedFunction<typeof getSentryInstance>;

interface MockSpan {
  setStatus: jest.Mock;
  setAttribute: jest.Mock;
  end: jest.Mock;
}

describe("order tracing", () => {
  it("executes operation immediately when Sentry is disabled", async () => {
    isSentryEnabledMock.mockReturnValue(false);
    const result = await traceOrderOperation(
      "checkout",
      { orderId: "ord_1" },
      async ({ setContext }) => {
        setContext({ operationStage: "payment" });
        return "ok";
      },
    );

    expect(result).toBe("ok");
    expect(getSentryInstanceMock).not.toHaveBeenCalled();
  });

  it("captures span attributes and errors when Sentry is enabled", async () => {
    isSentryEnabledMock.mockReturnValue(true);

    const errorSpan: MockSpan = {
      setStatus: jest.fn(),
      setAttribute: jest.fn(),
      end: jest.fn(),
    };

    const startSpan = async (
      _options: unknown,
      callback: (span: MockSpan) => Promise<void>,
    ): Promise<void> => callback(errorSpan);

    getSentryInstanceMock.mockReturnValue({
      startSpan,
    } as never);

    await expect(
      traceOrderOperation(
        "fulfill",
        { orderId: "ord_1", cartId: "cart_2" },
        async ({ setContext }) => {
          setContext({ reference: "REF-1" });
          throw new Error("fulfillment failure");
        },
      ),
    ).rejects.toThrow("fulfillment failure");

    expect(errorSpan.setStatus).toHaveBeenCalledWith({
      code: 2,
      message: "fulfillment failure",
    });
    expect(errorSpan.setAttribute).toHaveBeenCalledWith("order.error", true);
    expect(errorSpan.setAttribute).toHaveBeenCalledWith(
      "order.error_message",
      "fulfillment failure",
    );
    expect(errorSpan.setAttribute).toHaveBeenCalledWith("order.id", "ord_1");
    expect(errorSpan.setAttribute).toHaveBeenCalledWith("order.cart_id", "cart_2");
    expect(errorSpan.setAttribute).toHaveBeenCalledWith("order.reference", "REF-1");
    expect(errorSpan.end).toHaveBeenCalled();
  });

  it("marks spans as successful when no errors occur", async () => {
    isSentryEnabledMock.mockReturnValue(true);

    const successSpan: MockSpan = {
      setStatus: jest.fn(),
      setAttribute: jest.fn(),
      end: jest.fn(),
    };

    getSentryInstanceMock.mockReturnValue({
      startSpan: async (_options: unknown, callback: (span: MockSpan) => Promise<void>) =>
        callback(successSpan),
    } as never);

    const result = await traceOrderOperation(
      "ship",
      { orderId: "ord_2" },
      async ({ setContext }) => {
        setContext({ operationStage: "dispatch" });
        return "done";
      },
    );

    expect(result).toBe("done");
    expect(successSpan.setStatus).toHaveBeenCalledWith({ code: 1 });
    expect(successSpan.setAttribute).toHaveBeenCalledWith("order.operation_stage", "dispatch");
    expect(successSpan.end).toHaveBeenCalled();
  });
});
