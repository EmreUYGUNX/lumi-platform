import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import LoginPage from "@/app/(auth)/login/page";
import RegisterPage from "@/app/(auth)/register/page";

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  vi.resetModules();
  process.env = { ...ORIGINAL_ENV };
});

describe("Authentication flows", () => {
  it("collects credentials on the login screen", async () => {
    const user = userEvent.setup();
    render(<LoginPage />);

    await user.type(screen.getByPlaceholderText("founder@lumi.com"), "demo@lumi.com");
    await user.type(screen.getByPlaceholderText("••••••••"), "Secret123!");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    expect(screen.getByRole("link", { name: /create an account/i })).toHaveAttribute(
      "href",
      "/register",
    );
  });

  it("walks a visitor through the registration form", async () => {
    const user = userEvent.setup();
    render(<RegisterPage />);

    await user.type(screen.getByPlaceholderText("Leyla Işık"), "Ada Lovelace");
    await user.type(screen.getByPlaceholderText("founder@lumi.com"), "ada@analytical.com");
    await user.type(screen.getByPlaceholderText("••••••••"), "SecurePass123!");

    expect(screen.getByRole("checkbox")).not.toBeChecked();
    await user.click(screen.getByRole("checkbox"));
    expect(screen.getByRole("checkbox")).toBeChecked();

    expect(screen.getByRole("button", { name: /create account/i })).toBeEnabled();
    expect(screen.getByRole("link", { name: /sign in/i })).toHaveAttribute("href", "/login");
  });

  it("redirects unauthenticated users when guards are enforced", async () => {
    process.env.NEXT_PUBLIC_REQUIRE_AUTH_GUARDS = "true";
    process.env.NEXT_PUBLIC_ENABLE_MOCK_USER = "false";
    vi.resetModules();

    const { default: DashboardLayout } = await import(
      "@/app/(dashboard)/dashboard/layout" /* webpackChunkName: "dashboard-layout" */
    );

    await expect(
      DashboardLayout({
        children: <div>secure content</div>,
        sidebar: <div>sidebar</div>,
        modal: <div>modal</div>,
      }),
    ).rejects.toThrow(/REDIRECT:\/login/);
  });

  it("allows preview access when guards are disabled", async () => {
    const { default: DashboardLayout } = await import("@/app/(dashboard)/dashboard/layout");
    const layout = await DashboardLayout({
      children: <div>preview dashboard</div>,
      sidebar: <div>sidebar</div>,
      modal: <div>modal</div>,
    });

    render(layout);
    expect(screen.getByText("preview dashboard")).toBeInTheDocument();
    expect(screen.getByText("sidebar")).toBeInTheDocument();
  });
});
