// The page chrome on the public pages: the nav wraps its links instead of
// scrolling them and starts each line at its left edge, and the footer's
// logo, about text and links are all in one row or all in one column, never
// in between, at every width.
import { expect, type Locator, test } from "@playwright/test";
import { routes } from "../routes.ts";

const widths = [320, 480, 640, 768, 1024, 1280, 1600];

// The left, top and bottom edge of each child, in px.
const edges = (locator: Locator) =>
	locator.evaluate((element) =>
		[...element.children].map((child) => {
			const { left, top, bottom } = child.getBoundingClientRect();
			return { left, top, bottom };
		}),
	);

for (const route of routes.filter((route) => route !== "/brand/specimen/")) {
	test(`${route} wraps the nav and switches the footer`, async ({
		page,
	}, info) => {
		test.skip(
			info.project.name === "dark",
			"layout does not depend on the scheme",
		);
		expect((await page.goto(route))?.status()).toBe(200);
		const nav = page.getByRole("navigation", { name: "Primary" });
		await expect(nav.getByText("Loading…")).toHaveCount(0);
		const links = nav.locator("> ul");
		const switcher = page.locator("footer.footer > .switcher");

		for (const width of widths) {
			await page.setViewportSize({ width, height: 900 });

			// No scroll box: the links fit their list, which fits the nav.
			const list = await links.evaluate((element) => ({
				scroll: element.scrollWidth,
				client: element.clientWidth,
				right: element.getBoundingClientRect().right,
				parent: element.parentElement?.getBoundingClientRect().right ?? 0,
			}));
			expect(list.scroll, `${width}px`).toBeLessThanOrEqual(list.client);
			expect(list.right, `${width}px`).toBeLessThanOrEqual(list.parent + 0.5);

			// Below the logo, the links start where the logo starts.
			const [logo, rest] = await edges(nav);
			if (logo && rest && rest.top >= logo.bottom) {
				expect(rest.left, `${width}px`).toBeCloseTo(logo.left, 0);
			}

			// One row (one top) or one column (one left), never a mix.
			const cells = await edges(switcher);
			expect(cells, `${width}px`).toHaveLength(3);
			const tops = new Set(cells.map(({ top }) => Math.round(top)));
			const lefts = new Set(cells.map(({ left }) => Math.round(left)));
			expect(
				(tops.size === 1 && lefts.size === 3) ||
					(tops.size === 3 && lefts.size === 1),
				`${width}px: tops ${[...tops]}, lefts ${[...lefts]}`,
			).toBe(true);
		}
	});
}
