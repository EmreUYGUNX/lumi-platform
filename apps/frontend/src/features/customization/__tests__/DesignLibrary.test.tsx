import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { DesignLibrary } from "../components/editor/DesignLibrary";

vi.mock("../hooks/useClipartAssets", () => ({
  useClipartAssets: () => ({
    isLoading: false,
    data: {
      items: [
        {
          id: "ckclipartfixture000000000000",
          name: "Star",
          description: undefined,
          category: "icons",
          tags: ["star"],
          isPaid: false,
          price: { amount: "0.00", currency: "TRY" },
          svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><path fill="#facc15" d="M48 6l12.6 25.5 28.2 4.1-20.4 19.9 4.8 28.1L48 70.9 22.8 83.7l4.8-28.1L7.2 35.6l28.2-4.1L48 6z"/></svg>`,
          thumbnailUrl: undefined,
          usageCount: 0,
          createdAt: "2024-01-01T00:00:00.000Z",
          updatedAt: "2024-01-01T00:00:00.000Z",
        },
      ],
      pagination: {
        page: 1,
        pageSize: 1,
        totalItems: 1,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false,
      },
    },
  }),
}));

vi.mock("../hooks/useDesignTemplates", () => ({
  useDesignTemplates: () => ({
    isLoading: false,
    data: {
      items: [
        {
          id: "cktemplatefixture00000000000",
          name: "Minimal Logo",
          description: undefined,
          category: "minimal",
          tags: ["logo"],
          isPaid: false,
          price: { amount: "0.00", currency: "TRY" },
          thumbnailUrl: undefined,
          previewUrl: undefined,
          isPublished: true,
          isFeatured: false,
          usageCount: 0,
          createdAt: "2024-01-01T00:00:00.000Z",
          updatedAt: "2024-01-01T00:00:00.000Z",
        },
      ],
      pagination: {
        page: 1,
        pageSize: 1,
        totalItems: 1,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false,
      },
    },
  }),
}));

const createWrapper = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe("DesignLibrary", () => {
  it("allows selecting clipart assets", async () => {
    const onOpenChange = vi.fn();
    const onSelectDesign = vi.fn();
    const onSelectClipart = vi.fn();

    const user = userEvent.setup();

    render(
      <DesignLibrary
        open
        onOpenChange={onOpenChange}
        onSelectDesign={onSelectDesign}
        onSelectClipart={onSelectClipart}
      />,
      { wrapper: createWrapper() },
    );

    await user.click(screen.getByRole("tab", { name: "Clipart" }));
    await user.click(await screen.findByText("Star"));

    expect(onSelectClipart).toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("allows selecting templates", async () => {
    const onOpenChange = vi.fn();
    const onSelectDesign = vi.fn();
    const onSelectTemplate = vi.fn();

    const user = userEvent.setup();

    render(
      <DesignLibrary
        open
        onOpenChange={onOpenChange}
        onSelectDesign={onSelectDesign}
        onSelectTemplate={onSelectTemplate}
      />,
      { wrapper: createWrapper() },
    );

    await user.click(screen.getByRole("tab", { name: "Templates" }));
    await user.click(await screen.findByText("Minimal Logo"));

    expect(onSelectTemplate).toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
