// The element defaults in src/styles/base.css: a section without a class is a
// stack at the xs step, a description list's group without a class one at the
// 3xs step, and their children may shrink below their longest word. A class on
// the element opts out, so only class-less ones are checked.
import { expect, test } from "@playwright/test";
import { px, tokens } from "../../scripts/fluid-scale.js";
import { routes } from "../routes.ts";

const width = 1280;
const space = (name: string) => {
	const token = tokens.find((entry) => entry.name === name);
	if (!token) throw new Error(`no token ${name}`);
	return px(token, width);
};

test("plain sections and description-list groups stack", async ({
	page,
}, info) => {
	test.skip(
		info.project.name === "dark",
		"layout does not depend on the scheme",
	);
	await page.setViewportSize({ width, height: 800 });
	let checked = 0;
	for (const route of routes) {
		expect((await page.goto(route))?.status()).toBe(200);
		const found = await page.evaluate(() =>
			[
				...document.querySelectorAll(
					"section:not([class]), dl > div:not([class])",
				),
			].map((element) => {
				const style = getComputedStyle(element);
				return {
					element: element.tagName.toLowerCase(),
					display: style.display,
					gap: Number.parseFloat(style.rowGap),
					shrink: [...element.children].every(
						(child) => getComputedStyle(child).minWidth === "0px",
					),
				};
			}),
		);
		for (const { element, ...style } of found) {
			expect(style, `${route} ${element}`).toEqual({
				display: "grid",
				gap: expect.closeTo(
					space(element === "section" ? "space-xs" : "space-3xs"),
					1,
				),
				shrink: true,
			});
		}
		checked += found.length;
	}
	expect(checked).toBeGreaterThan(0);
});
