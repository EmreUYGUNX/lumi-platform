import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { DesignLibrary } from "../components/editor/DesignLibrary";

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
