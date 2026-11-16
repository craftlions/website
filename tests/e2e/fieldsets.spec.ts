// A fieldset names its group with a legend; fields that are no group in the
// accessibility sense sit in a plain element instead (WCAG 1.3.1).
import { expect, test } from "@playwright/test";
import { routes } from "../routes.ts";

for (const route of routes) {
	test(`${route} names every fieldset`, async ({ page }) => {
		expect((await page.goto(route))?.status()).toBe(200);
		await expect(page.locator("fieldset:not(:has(> legend))")).toHaveCount(0);
	});
}
