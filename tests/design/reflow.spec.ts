import { expect, type Page, test } from "@playwright/test";
import { routes } from "../routes.ts";

const audit = (page: Page) =>
	page.evaluate(() => ({
		overflow: document.documentElement.scrollWidth - window.innerWidth,
		collapsed: [...document.querySelectorAll("body *")]
			.filter(
				(element) =>
					element.checkVisibility() &&
					[...element.childNodes].some(
						(node) =>
							node.nodeType === Node.TEXT_NODE && node.textContent?.trim(),
					) &&
					element.getBoundingClientRect().width === 0,
			)
			.map((element) => element.outerHTML.slice(0, 120)),
		clipped: [
			...document.querySelectorAll<HTMLElement>(
				"a, button, input, select, textarea",
			),
		]
			.filter(
				(element) =>
					element.checkVisibility() &&
					!element.closest(".truncate") &&
					element.scrollWidth > element.clientWidth,
			)
			.map((element) => element.outerHTML.slice(0, 120)),
	}));

const open = async (page: Page, route: string) => {
	expect((await page.goto(route))?.status()).toBe(200);
	await expect(page.getByText("Loading…")).toHaveCount(0);
};

const clean = { overflow: 0, collapsed: [], clipped: [] };

for (const route of routes) {
	test.describe(route, () => {
		test("320px", async ({ page }) => {
			await page.setViewportSize({ width: 320, height: 800 });
			await open(page, route);
			expect(await audit(page)).toEqual(clean);
		});

		for (const width of [768, 1024]) {
			test(`${width}px`, async ({ page }) => {
				await page.setViewportSize({ width, height: 800 });
				await open(page, route);
				expect(await audit(page)).toEqual(clean);
			});
		}

		test.describe("200% zoom", () => {
			test.use({ viewport: { width: 640, height: 400 }, deviceScaleFactor: 2 });
			test("640px", async ({ page }) => {
				await open(page, route);
				expect(await audit(page)).toEqual(clean);
			});
		});

		test("200% text size", async ({ page }) => {
			await (await page.context().newCDPSession(page)).send(
				"Page.setFontSizes",
				{ fontSizes: { standard: 32 } },
			);
			await open(page, route);
			expect(
				await page.evaluate(
					() => getComputedStyle(document.documentElement).fontSize,
				),
			).toBe("32px");
			expect(await audit(page)).toEqual(clean);
		});
	});
}
