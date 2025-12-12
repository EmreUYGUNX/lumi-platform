import { expect, test } from "@playwright/test";

test.setTimeout(60_000);

test.describe("mobile viewport", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("renders the hero and primary calls to action", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /premium minimalist drop/i })).toBeVisible();
    await expect(page.getByText(/glassmorphic silhouettes/i)).toBeVisible();
    await expect(page.getByRole("link", { name: /shop collection/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /view lookbook/i })).toBeVisible();
  });
});
