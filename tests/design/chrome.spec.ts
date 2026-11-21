import { expect, type Locator, test } from "@playwright/test";
import { routes } from "../routes.ts";

const widths = [320, 480, 640, 768, 1024, 1280, 1600];

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

			const list = await links.evaluate((element) => ({
				scroll: element.scrollWidth,
				client: element.clientWidth,
				right: element.getBoundingClientRect().right,
				parent: element.parentElement?.getBoundingClientRect().right ?? 0,
			}));
			expect(list.scroll, `${width}px`).toBeLessThanOrEqual(list.client);
			expect(list.right, `${width}px`).toBeLessThanOrEqual(list.parent + 0.5);

			const [logo, rest] = await edges(nav);
			if (logo && rest && rest.top >= logo.bottom) {
				expect(rest.left, `${width}px`).toBeCloseTo(logo.left, 0);
			}

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
