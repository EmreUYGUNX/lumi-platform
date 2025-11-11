import { describe, expect, it, jest } from "@jest/globals";

import { traceOrderOperation } from "../order-tracing.js";

jest.mock("../sentry.js", () => {
  const spanMock = {
    setAttribute: jest.fn().mockReturnThis(),
    setStatus: jest.fn().mockReturnThis(),
    end: jest.fn(),
  };

  const startSpan = jest.fn((_context: unknown, callback: (span: typeof spanMock) => unknown) =>
    callback(spanMock),
  );

  return {
    getSentryInstance: jest.fn(() => ({
      startSpan,
    })),
    isSentryEnabled: jest.fn(() => true),
    __mocks: {
      spanMock,
      startSpan,
    },
  };
});

const { isSentryEnabled, __mocks: sentryMocks } = jest.requireMock("../sentry.js") as {
  isSentryEnabled: jest.Mock;
  __mocks: {
    spanMock: {
      setAttribute: jest.Mock;
      setStatus: jest.Mock;
      end: jest.Mock;
    };
    startSpan: jest.Mock;
  };
};

describe("traceOrderOperation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    isSentryEnabled.mockReturnValue(true);
  });

  it("executes the handler immediately when Sentry is disabled", async () => {
    isSentryEnabled.mockReturnValue(false);

    const handler = jest.fn(async () => "ok");
    const result = await traceOrderOperation("create", { userId: "user-1" }, handler);

    expect(result).toBe("ok");
    expect(handler).toHaveBeenCalledTimes(1);
    expect(sentryMocks.startSpan).not.toHaveBeenCalled();
  });

  it("records attributes and marks the span as successful", async () => {
    const result = await traceOrderOperation(
      "create",
      { userId: "user-1", cartId: "cart-9" },
      async ({ setContext }) => {
        setContext({ orderId: "order-123", reference: "REF-001" });
        return "success";
      },
    );

    expect(result).toBe("success");
    expect(sentryMocks.startSpan).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "order.create",
        op: "order",
        attributes: { "order.operation": "create" },
      }),
      expect.any(Function),
    );
    expect(sentryMocks.spanMock.setAttribute).toHaveBeenCalledWith("order.id", "order-123");
    expect(sentryMocks.spanMock.setAttribute).toHaveBeenCalledWith("order.reference", "REF-001");
    expect(sentryMocks.spanMock.setStatus).toHaveBeenCalledWith({ code: 1 });
    expect(sentryMocks.spanMock.end).toHaveBeenCalledTimes(1);
  });

  it("marks the span as failed and rethrows errors", async () => {
    const error = new Error("payment failed");

    await expect(
      traceOrderOperation("refund", { orderId: "order-x" }, async () => {
        throw error;
      }),
    ).rejects.toThrow("payment failed");

    expect(sentryMocks.spanMock.setStatus).toHaveBeenCalledWith({
      code: 2,
      message: "payment failed",
    });
    expect(sentryMocks.spanMock.setAttribute).toHaveBeenCalledWith("order.error", true);
    expect(sentryMocks.spanMock.end).toHaveBeenCalledTimes(1);
  });
});
