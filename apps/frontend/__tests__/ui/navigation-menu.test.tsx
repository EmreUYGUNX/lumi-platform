import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu";

describe("NavigationMenu", () => {
  it("exposes trigger styling helper", () => {
    const classes = navigationMenuTriggerStyle();
    expect(classes).toContain("inline-flex");
    expect(classes).toContain("rounded-md");
  });

  it("opens content when trigger is activated", async () => {
    const user = userEvent.setup();
    render(
      <NavigationMenu>
        <NavigationMenuList>
          <NavigationMenuItem>
            <NavigationMenuTrigger>Products</NavigationMenuTrigger>
            <NavigationMenuContent>
              <div data-testid="nav-content">Navigation payload</div>
            </NavigationMenuContent>
          </NavigationMenuItem>
        </NavigationMenuList>
      </NavigationMenu>,
    );

    const trigger = screen.getByRole("button", { name: /products/i });
    expect(trigger.dataset.state).toBe("closed");

    await user.click(trigger);

    await waitFor(() => expect(trigger.dataset.state).toBe("open"));
    expect(screen.getByTestId("nav-content")).toBeInTheDocument();
  });
});
