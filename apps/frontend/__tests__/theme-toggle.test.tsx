import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { ThemeProvider } from "@/providers/ThemeProvider";

describe("ThemeToggle", () => {
  it("toggles between light and dark themes", async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider defaultTheme="light" attribute="data-theme">
        <ThemeToggle />
      </ThemeProvider>,
    );

    const toggle = await screen.findByRole("button", { name: /toggle color theme/i });
    expect(toggle).toHaveAttribute("aria-pressed", "false");

    await user.click(toggle);

    await waitFor(() => expect(toggle).toHaveAttribute("aria-pressed", "true"));
    expect(document.documentElement.dataset.theme).toBe("dark");
  });
});
