// The skip link (WCAG 2.4.1): the first Tab from page load reaches it, it is
// shown only while it has focus, and following it moves focus to the main
// landmark, so the next Tab starts inside the content.
import { expect, test } from "@playwright/test";
import { routes } from "../routes.ts";

for (const route of routes) {
	test(`${route} skips to the content`, async ({ page }) => {
		expect((await page.goto(route))?.status()).toBe(200);
		await expect(page.getByText("Loading…")).toHaveCount(0);
		const link = page.getByRole("link", { name: "Skip to content" });
		const main = page.getByRole("main");

		expect((await link.boundingBox())?.y ?? 0).toBeLessThan(0);
		await page.keyboard.press("Tab");
		await expect(link).toBeFocused();
		await expect(link).toBeInViewport({ ratio: 1 });

		await page.keyboard.press("Enter");
		await expect(main).toBeFocused();
		expect((await link.boundingBox())?.y ?? 0).toBeLessThan(0);
		await page.keyboard.press("Tab");
		expect(
			await main.evaluate((element) =>
				element.contains(document.activeElement),
			),
		).toBe(true);
	});
}
