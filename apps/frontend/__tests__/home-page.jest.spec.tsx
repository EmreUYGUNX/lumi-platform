import { describe, it } from "@jest/globals";
import { render, screen } from "@testing-library/react";

import HomePage from "@/app/page";

describe("HomePage component", () => {
  it("renders the hero headline, CTA buttons, and highlight cards", () => {
    render(<HomePage />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: /next\.js foundation for lumi's immersive commerce experience/i,
      }),
    ).toBeInTheDocument();

    expect(screen.getByRole("button", { name: /explore architecture/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /review design tokens/i })).toBeInTheDocument();

    ["Composable storefronts", "Enterprise foundations", "Experiential UI"].forEach((title) => {
      expect(
        screen.getByRole("heading", { level: 2, name: new RegExp(title, "i") }),
      ).toBeInTheDocument();
    });
  });
});
