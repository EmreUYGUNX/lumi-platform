import { describe, it } from "@jest/globals";
import { render, screen } from "@testing-library/react";

import HomePage from "@/app/page";

describe("HomePage component", () => {
  it("renders the hero headline, CTA buttons, and highlight cards", () => {
    render(<HomePage />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: /build experience-first commerce with deneme\.html precision\./i,
      }),
    ).toBeInTheDocument();

    expect(screen.getByRole("link", { name: /schedule a briefing/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /view platform overview/i })).toBeInTheDocument();

    ["Adaptive Storefronts", "Commerce Orchestration", "Customer Graph"].forEach((title) => {
      const lookup = title.toLowerCase();
      expect(
        screen.getByText((content) => content.toLowerCase().includes(lookup)),
      ).toBeInTheDocument();
    });
  });
});
