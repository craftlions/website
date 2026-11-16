// T3, fluid scale: every type and space step on /brand/specimen measures what
// scripts/fluid-scale.js predicts at fixed widths, so the scale cannot drift.
// Text must still reach 200% (WCAG 1.4.4): a vw term ignores text zoom and is
// cancelled by page zoom, which shrinks the viewport, so its share stays small.
import { expect, type Page, test } from "@playwright/test";
import { px, tokens } from "../../scripts/fluid-scale.js";

const type = tokens.filter(({ name }) => name.startsWith("step-"));

// A type probe's font size, a space probe's width, in px.
const measure = async (page: Page) => {
	expect((await page.goto("/brand/specimen/"))?.status()).toBe(200);
	return page
		.locator("[data-probe]")
		.evaluateAll((probes) =>
			Object.fromEntries(
				probes.map((probe) => [
					probe.getAttribute("data-probe"),
					probe.getAttribute("data-probe")?.startsWith("step-")
						? Number.parseFloat(getComputedStyle(probe).fontSize)
						: probe.getBoundingClientRect().width,
				]),
			),
		);
};

// Every token whose probe is missing or more than 0.05px off.
const drift = (sizes: Record<string, number>, width: number, root = 16) =>
	tokens
		.map((token) => ({
			name: token.name,
			actual: sizes[token.name],
			expected: px(token, width, root),
		}))
		.filter(
			({ actual, expected }) =>
				actual === undefined || Math.abs(actual - expected) > 0.05,
		)
		.map(
			({ name, actual, expected }) =>
				`${name}: ${actual}px, expected ${expected.toFixed(2)}px`,
		);

test("type steps reach 200% at 500% page zoom and 300% text zoom", () => {
	// Page zoom: at most 2.5 times from the smallest to the largest size.
	expect(type.filter(({ min, max }) => max > 2.5 * min)).toEqual([]);
	// Text zoom scales only the rem share, so 300% must double every size.
	expect(
		type.filter((token) =>
			Array.from({ length: 221 }, (_, index) => 320 + index * 16).some(
				(width) => px(token, width, 48) < 2 * px(token, width),
			),
		),
	).toEqual([]);
});

for (const width of [320, 768, 1280, 1920]) {
	test(`${width}px`, async ({ page }) => {
		await page.setViewportSize({ width, height: 800 });
		expect(drift(await measure(page), width)).toEqual([]);
	});
}

// Chromium's default font size setting, which rem follows: 32px is 200% text
// size, 48px is 300%, where every type step must at least double.
for (const root of [32, 48]) {
	for (const width of [320, 1280]) {
		test(`${width}px at ${root}px text size`, async ({ page }) => {
			await page.setViewportSize({ width, height: 800 });
			await (await page.context().newCDPSession(page)).send(
				"Page.setFontSizes",
				{ fontSizes: { standard: root } },
			);
			const sizes = await measure(page);
			expect(drift(sizes, width, root)).toEqual([]);
			if (root === 48) {
				expect(
					type
						.filter(
							(token) => !((sizes[token.name] ?? 0) >= 2 * px(token, width)),
						)
						.map(({ name }) => name),
				).toEqual([]);
			}
		});
	}
}
