import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, it, vi } from "vitest";

import HomePage from "@/app/page";

vi.mock("@/features/homepage/hooks/useJustDroppedProducts", () => ({
  useJustDroppedProducts: () => ({
    data: { items: [] },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
    isFetching: false,
  }),
}));

describe("HomePage component", () => {
  it("renders the hero headline, CTA buttons, and highlight cards", () => {
    const client = new QueryClient();
    render(
      <QueryClientProvider client={client}>
        <HomePage />
      </QueryClientProvider>,
    );

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: /premium minimalist drop/i,
      }),
    ).toBeInTheDocument();

    expect(screen.getByRole("link", { name: /shop collection/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /view lookbook/i })).toBeInTheDocument();

    expect(
      screen.getByRole("heading", { level: 2, name: /the maison's collections/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/just dropped/i)).toBeInTheDocument();
  });
});
