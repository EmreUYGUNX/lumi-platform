import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type * as fabric from "fabric";
import { describe, expect, it, vi } from "vitest";

import { apiClient } from "@/lib/api-client";

import type { LoadDesignResult } from "../hooks/useLoadDesign";
import { LoadDesignModal } from "../components/editor/LoadDesignModal";

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

const deleteDesignSpy = vi.fn().mockImplementation(async () => {});
const loadDesignSpy = vi.fn().mockImplementation(async ({ sessionId }: { sessionId: string }) => {
  return {
    session: {
      id: sessionId,
      productId: "product_123",
      designArea: "front",
      sessionData: {},
      isPublic: false,
      viewCount: 0,
      lastEditedAt: "2025-01-02T00:00:00.000Z",
      expiresAt: "2025-02-02T00:00:00.000Z",
      createdAt: "2025-01-01T00:00:00.000Z",
      updatedAt: "2025-01-01T00:00:00.000Z",
    },
    meta: { name: "Holiday Special", tags: ["holiday"] },
    restoredLayers: 2,
    failedLayers: 0,
  } satisfies LoadDesignResult;
});

vi.mock("../hooks/useLoadDesign", () => {
  return {
    useLoadDesign: () => ({
      listSessions: {
        isLoading: false,
        isFetching: false,
        isFetchingNextPage: false,
        hasNextPage: false,
        fetchNextPage: vi.fn().mockImplementation(async () => {}),
      },
      sessionSummaries: [
        {
          id: "sess_1234_abcd",
          productId: "product_123",
          designArea: "front",
          thumbnailUrl: "https://example.com/thumb.webp",
          isPublic: false,
          lastEditedAt: "2025-01-01T00:00:00.000Z",
          expiresAt: "2025-02-01T00:00:00.000Z",
        },
        {
          id: "sess_5678_efgh",
          productId: "product_123",
          designArea: "front",
          isPublic: true,
          shareToken: "share_token",
          lastEditedAt: "2025-01-02T00:00:00.000Z",
          expiresAt: "2025-02-02T00:00:00.000Z",
        },
      ],
      deleteDesign: {
        isPending: false,
        mutateAsync: deleteDesignSpy,
      },
      loadMutation: {
        isPending: false,
      },
      loadDesign: loadDesignSpy,
    }),
  };
});

describe("LoadDesignModal", () => {
  it("lists sessions and triggers load/delete actions", async () => {
    const user = userEvent.setup();

    class IntersectionObserverMock {
      observe = vi.fn();

      unobserve = vi.fn();

      disconnect = vi.fn();
    }

    if (!("IntersectionObserver" in window)) {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore - jsdom polyfill
      window.IntersectionObserver = IntersectionObserverMock;
    }

    const apiGetSpy = vi.spyOn(apiClient, "get").mockImplementation(async (path: string) => {
      const name = path.includes("sess_5678_efgh") ? "Winter Drop" : "Holiday Special";
      return {
        data: { sessionData: { lumiEditor: { name } } },
      } as unknown as Awaited<ReturnType<typeof apiClient.get>>;
    });

    const onOpenChange = vi.fn();
    const onLoaded = vi.fn();

    render(
      <LoadDesignModal
        open
        onOpenChange={onOpenChange}
        canvas={{} as unknown as fabric.Canvas}
        productId="product_123"
        designArea="front"
        onLoaded={onLoaded}
      />,
      { wrapper: createWrapper() },
    );

    expect(await screen.findByText("Holiday Special")).toBeInTheDocument();
    expect(await screen.findByText("Winter Drop")).toBeInTheDocument();
    expect(apiGetSpy).toHaveBeenCalled();

    const holidayItem = screen.getByText("Holiday Special").closest("li");
    expect(holidayItem).not.toBeNull();
    await user.click(within(holidayItem as HTMLElement).getByLabelText("Delete design"));
    expect(deleteDesignSpy).toHaveBeenCalledWith("sess_1234_abcd");

    const searchInput = screen.getByPlaceholderText("Search designs…");
    await user.type(searchInput, "holiday");
    expect(screen.getByText("Holiday Special")).toBeInTheDocument();
    expect(screen.queryByText("Winter Drop")).not.toBeInTheDocument();

    await user.click(screen.getByText("Holiday Special"));
    expect(loadDesignSpy).toHaveBeenCalled();
    expect(onLoaded).toHaveBeenCalledWith(
      expect.objectContaining({
        meta: expect.objectContaining({ name: "Holiday Special" }),
      }),
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);

    apiGetSpy.mockRestore();
  });
});
