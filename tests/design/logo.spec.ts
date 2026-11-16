// The brand rule of /brand#logo on the site's own logo: the header and footer
// paint the mark in the wordmark's one colour, the ink, in the light scheme and
// in the gradient in the dark; forced colors paint it in the wordmark's system
// color in both.
import { readFileSync } from "node:fs";
import { expect, type Page, test } from "@playwright/test";
import { parseTokens } from "../../src/lib/contrast.ts";
import { routes } from "../routes.ts";

const tokens = parseTokens(readFileSync("src/styles/tokens.css", "utf8"));
const rgb = (hex: string) =>
	`rgb(${[1, 3, 5].map((start) => Number.parseInt(hex.slice(start, start + 2), 16)).join(", ")})`;
const stop = (name: string) => tokens.find((token) => token.name === name);

// Each logo's color and the computed colors of its two gradient stops.
const logos = (page: Page) =>
	page
		.locator("nav.nav > a > svg, footer.footer > a > svg")
		.evaluateAll((svgs) =>
			svgs.map((svg) => ({
				color: getComputedStyle(svg).color,
				stops: [...svg.querySelectorAll("stop")].map(
					(element) => getComputedStyle(element).stopColor,
				),
			})),
		);

// The specimen renders primitives, not the header and footer.
for (const route of routes.filter((route) => route !== "/brand/specimen/")) {
	test(`${route} paints the logo by the scheme`, async ({ page }, info) => {
		await page.goto(route);
		const scheme = info.project.name === "dark" ? "dark" : "light";
		const expected = ["logo-start", "logo-end"].map((name) =>
			rgb(stop(name)?.[scheme] ?? ""),
		);
		const found = await logos(page);
		expect(found).toHaveLength(2);
		for (const { color, stops } of found) {
			expect(stops).toEqual(expected);
			if (scheme === "light") {
				expect(stops).toEqual([color, color]);
			}
		}
	});

	test(`${route} paints the logo in one system color in forced colors`, async ({
		page,
	}) => {
		await page.emulateMedia({ forcedColors: "active" });
		await page.goto(route);
		for (const { color, stops } of await logos(page)) {
			expect(stops).toEqual([color, color]);
		}
	});
}
