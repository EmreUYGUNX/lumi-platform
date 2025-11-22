import { expect, test } from "@playwright/test";

test.describe("mobile viewport", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("renders the hero and primary calls to action", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", {
        name: /build experience-first commerce with deneme\.html precision\./i,
      }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: /schedule a briefing/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /view platform overview/i })).toBeVisible();
  });
});
