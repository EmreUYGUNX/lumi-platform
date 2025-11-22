import { expect, test } from "@playwright/test";

test("login form allows navigation to dashboard", async ({ page }) => {
  await page.goto("/login");

  await page.getByPlaceholder("founder@lumi.com").fill("demo@lumi.com");
  await page.getByPlaceholder("••••••••").fill("SecurePass123!");
  await page.getByRole("button", { name: /sign in/i }).click();

  await page.goto("/dashboard");
  await expect(page.getByText("Ship the next commerce milestone.")).toBeVisible();
});
