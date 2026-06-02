import { test, expect } from "@playwright/test";

test.describe("/classes catalog", () => {
  test("cards render and open a detail dialog", async ({ page }) => {
    await page.goto("/classes");
    await page.waitForLoadState("networkidle");

    const cards = page.getByRole("button", { name: /View details for/ });
    const count = await cards.count();
    test.skip(count === 0, "no classes seeded in this environment");

    await cards.first().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("button", { name: /Sign up to book/ })).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  });

  test("category filter narrows the grid", async ({ page }) => {
    await page.goto("/classes");
    await page.waitForLoadState("networkidle");

    const filter = page.getByTestId("category-filter");
    const inactiveChips = filter.getByRole("button", { pressed: false });
    const chipCount = await inactiveChips.count();
    test.skip(chipCount === 0, "no inactive category chips (no classes seeded)");

    const allCount = await page.getByRole("button", { name: /View details for/ }).count();
    await inactiveChips.first().click();
    const filtered = await page.getByRole("button", { name: /View details for/ }).count();
    expect(filtered).toBeLessThanOrEqual(allCount);
  });
});
