// Scans the public pages and the /brand/system design reference with axe-core; the light
// and dark projects in playwright.config.ts run each route in both schemes.
// Every violation fails, best-practice included, so fix it instead of excluding it.
import { AxeBuilder } from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const tags = [
	"wcag2a",
	"wcag2aa",
	"wcag21a",
	"wcag21aa",
	"wcag22aa",
	"best-practice",
];
// Each exclusion names its rule and says why: { id: "rule-id", reason: "…" }.
const excluded: { id: string; reason: string }[] = [];

for (const route of [
	"/",
	"/login",
	"/forgot-password",
	"/reset-password",
	"/imprint/",
	"/changelog/",
	"/brand/system/",
]) {
	test(route, async ({ page }) => {
		expect((await page.goto(route))?.status()).toBe(200);
		// Waits for the deferred nav island so the scan sees the final page.
		await expect(page.getByText("Loading…")).toHaveCount(0);
		const { violations } = await new AxeBuilder({ page })
			.withTags(tags)
			.disableRules(excluded.map(({ id }) => id))
			.analyze();
		expect(violations).toEqual([]);
	});
}
