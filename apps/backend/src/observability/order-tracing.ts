import type { Span } from "@sentry/node";

import { getSentryInstance, isSentryEnabled } from "./sentry.js";

type SpanStatusCode = 0 | 1 | 2;

export interface OrderTraceContext {
  orderId?: string;
  cartId?: string;
  userId?: string;
  sessionId?: string | null;
  reference?: string;
  operationStage?: string;
}

interface TraceHelpers {
  setContext: (extra: Partial<OrderTraceContext>) => void;
}

const resolveAttributeKey = (key: keyof OrderTraceContext): string | undefined => {
  switch (key) {
    case "orderId": {
      return "order.id";
    }
    case "cartId": {
      return "order.cart_id";
    }
    case "userId": {
      return "user.id";
    }
    case "sessionId": {
      return "session.id";
    }
    case "reference": {
      return "order.reference";
    }
    case "operationStage": {
      return "order.operation_stage";
    }
    default: {
      return undefined;
    }
  }
};

const STATUS_OK: SpanStatusCode = 1;
const STATUS_ERROR: SpanStatusCode = 2;

const applyContextAttributes = (span: Span | undefined, context: OrderTraceContext) => {
  if (!span) {
    return;
  }

  (Object.keys(context) as (keyof OrderTraceContext)[]).forEach((key) => {
    // eslint-disable-next-line security/detect-object-injection -- context keys are strongly typed
    const value = context[key];
    if (value === undefined || value === null) {
      return;
    }

    const attribute = resolveAttributeKey(key);
    if (attribute) {
      span.setAttribute(attribute, typeof value === "string" ? value : String(value));
    }
  });
};

export const traceOrderOperation = async <T>(
  operation: string,
  context: OrderTraceContext,
  execute: (helpers: TraceHelpers) => Promise<T>,
): Promise<T> => {
  const enrichedContext: OrderTraceContext = {
    ...context,
  };

  const setContext = (extra: Partial<OrderTraceContext>) => {
    Object.assign(enrichedContext, extra);
  };

  if (!isSentryEnabled()) {
    return execute({ setContext });
  }

  const sentry = getSentryInstance();
  const { startSpan } = sentry;

  if (typeof startSpan !== "function") {
    return execute({ setContext });
  }

  return startSpan(
    {
      name: `order.${operation}`,
      op: "order",
      attributes: {
        "order.operation": operation,
      },
    },
    async (span: Span) => {
      try {
        const result = await execute({ setContext });
        span.setStatus({ code: STATUS_OK });
        applyContextAttributes(span, enrichedContext);
        return result;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        span.setStatus({ code: STATUS_ERROR, message });
        span.setAttribute("order.error", true);
        span.setAttribute("order.error_message", message);
        applyContextAttributes(span, enrichedContext);
        throw error;
      } finally {
        span.end();
      }
    },
  );
};
