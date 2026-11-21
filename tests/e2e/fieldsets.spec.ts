import { expect, test } from "@playwright/test";
import { routes } from "../routes.ts";

for (const route of routes) {
	test(`${route} names every fieldset`, async ({ page }) => {
		expect((await page.goto(route))?.status()).toBe(200);
		await expect(page.locator("fieldset:not(:has(> legend))")).toHaveCount(0);
	});
}
