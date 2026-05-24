import { expect, type Page } from "@playwright/test";

export const PHONE_VIEWPORTS = [
  { name: "iphone-se", width: 320, height: 568 },
  { name: "iphone-12", width: 390, height: 844 },
  { name: "iphone-plus", width: 414, height: 896 },
];
export const TABLET_VIEWPORT = { name: "ipad", width: 768, height: 1024 };
export const ALL_VIEWPORTS = [...PHONE_VIEWPORTS, TABLET_VIEWPORT];

/** Fails if the document scrolls horizontally (1px tolerance for rounding). */
export async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => {
    const el = document.documentElement;
    return el.scrollWidth - el.clientWidth;
  });
  expect(overflow, "horizontal overflow in px").toBeLessThanOrEqual(1);
}
