import { expect, type Page, test } from "@playwright/test";
import { px, tokens } from "../../scripts/fluid-scale.js";

const type = tokens.filter(({ name }) => name.startsWith("step-"));

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
	expect(type.filter(({ min, max }) => max > 2.5 * min)).toEqual([]);
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
