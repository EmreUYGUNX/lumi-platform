import { describe, it } from "@jest/globals";
import { render, screen } from "@testing-library/react";

import HomePage from "@/app/page";

describe("HomePage component", () => {
  it("renders the primary heading and placeholder message", () => {
    render(<HomePage />);
    expect(
      screen.getByRole("heading", { level: 1, name: /lumi frontend placeholder/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/frontend application will be implemented in phase 6/i),
    ).toBeInTheDocument();
  });
});
