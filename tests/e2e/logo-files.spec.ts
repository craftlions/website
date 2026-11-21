import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

const paths = (svg: string) =>
	[...svg.matchAll(/\sd="([^"]+)"/g)].map(([, data]) => data);
const source = paths(
	readFileSync("src/assets/logoWithTextVertical.svg", "utf8"),
);

const standsAlone = (svg: string) => {
	expect(svg).not.toMatch(/currentColor/i);
	expect(svg).not.toMatch(/<script|\son\w+=/i);
	expect(svg).not.toMatch(/(?:href|src)="(?!#)|url\((?!#)|@import/i);
	expect(svg).not.toMatch(/var\(/);
};

test("every logo download on /brand is a standalone SVG of the source paths", async ({
	page,
	request,
}) => {
	await page.goto("/brand/");
	const links = page.locator("#logo a[download]");
	await expect(links).toHaveCount(9);
	for (const link of await links.all()) {
		await expect(link).toHaveText(/^Download .+, SVG$/);
		const href = (await link.getAttribute("href")) ?? "";
		expect(href).toMatch(/^\/brand\/craftlions-[\w-]+\.svg$/);
		const response = await request.get(href);
		expect(response.status(), href).toBe(200);
		expect(response.headers()["content-type"]).toMatch(/^image\/svg\+xml/);
		const svg = await response.text();
		standsAlone(svg);
		expect(paths(svg).length).toBeGreaterThan(0);
		for (const data of paths(svg)) {
			expect(source, href).toContain(data);
		}
	}
});

test("the SVG favicon draws the source mark and stands alone", async ({
	page,
	request,
}) => {
	await page.goto("/");
	await expect(
		page.locator('link[rel="icon"][type="image/svg+xml"]'),
	).toHaveAttribute("href", "/favicon.svg");
	const response = await request.get("/favicon.svg");
	expect(response.headers()["content-type"]).toMatch(/^image\/svg\+xml/);
	const svg = await response.text();
	standsAlone(svg);
	expect(paths(svg)).toHaveLength(1);
	expect(source).toContain(paths(svg)[0]);
});
