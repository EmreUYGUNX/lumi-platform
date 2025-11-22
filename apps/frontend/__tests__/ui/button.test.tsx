import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Button, buttonVariants } from "@/components/ui/button";

describe("Button component", () => {
  it("applies variant and size styles", () => {
    render(
      <Button variant="secondary" size="lg">
        Secondary Action
      </Button>,
    );

    const button = screen.getByRole("button", { name: "Secondary Action" });
    expect(button.className).toContain("bg-secondary");
    expect(button.className).toContain("h-11");
  });

  it("renders as a child element while preserving styling and refs", () => {
    render(
      <Button asChild>
        <a href="/dashboard">Visit dashboard</a>
      </Button>,
    );

    const anchor = screen.getByRole("link", { name: "Visit dashboard" });
    expect(anchor).toHaveAttribute("href", "/dashboard");
    expect(anchor.className).toContain(buttonVariants({ variant: "default", size: "default" }));
  });
});
