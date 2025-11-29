import { expect, test, request } from "@playwright/test";

const API_URL =
  process.env.E2E_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1";

test("product detail page renders with gallery and reviews", async ({ page }) => {
  const api = await request.newContext({ baseURL: API_URL });
  const response = await api.get("/catalog/products?page=1&perPage=1");

  if (!response.ok()) {
    test.skip(true, "Catalog API not reachable for product detail e2e.");
  }

  const payload = (await response.json()) as {
    success?: boolean;
    data?: { items?: { slug: string; title: string }[] };
  };

  const slug = payload?.data?.items?.[0]?.slug;
  const title = payload?.data?.items?.[0]?.title ?? "Product";

  if (!slug) {
    test.skip(true, "No products available to test product detail page.");
  }

  await page.goto(`/products/${slug}`);

  await expect(page.getByText(title)).toBeVisible({ timeout: 10_000 });

  await expect(
    page.getByRole("heading", { name: /reviews/i }).or(page.getByText(/reviews/i)),
  ).toBeVisible();

  const thumbnails = page.locator("button[aria-label*='Select'], button:has(img)");
  if ((await thumbnails.count()) > 1) {
    await thumbnails.nth(1).click();
  }

  await expect(
    page
      .getByRole("button", { name: /add to cart/i })
      .or(page.getByRole("button", { name: /quick add/i })),
  ).toBeVisible();
});
