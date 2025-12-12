import { expect, test } from "@playwright/test";

test.setTimeout(60_000);

test("home page renders shell", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /premium minimalist drop/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /shop collection/i })).toBeVisible();
});
