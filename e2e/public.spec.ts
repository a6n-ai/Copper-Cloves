import { test } from "@playwright/test";
import { expectNoHorizontalScroll } from "./helpers/viewport";

const PUBLIC_PAGES = [
  "/", "/classes", "/cafe", "/shop", "/rental", "/founder",
  "/policy", "/terms", "/meal-subscription", "/login", "/signup",
];

for (const path of PUBLIC_PAGES) {
  test(`no horizontal overflow: ${path}`, async ({ page }) => {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    await expectNoHorizontalScroll(page);
  });
}
