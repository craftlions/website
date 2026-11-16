// The public pages lay themselves out by the room they get: each test asserts
// what a page does across widths, not at which breakpoint.
import { expect, type Page, test } from "@playwright/test";
import { px, tokens } from "../../scripts/fluid-scale.js";

const space = (name: string, width: number) => {
	const token = tokens.find((step) => step.name === `space-${name}`);
	if (!token) throw new Error(`no --space-${name}`);
	return px(token, width);
};

// The box of each element the selector matches, in px.
const boxes = (page: Page, selector: string) =>
	page
		.locator(selector)
		.evaluateAll((elements) =>
			elements.map((element) => element.getBoundingClientRect().toJSON()),
		) as Promise<DOMRect[]>;

const box = async (page: Page, selector: string) => {
	const [found] = await boxes(page, selector);
	if (!found) throw new Error(`no ${selector}`);
	return found;
};

test.skip(
	({ colorScheme }) => colorScheme === "dark",
	"layout does not depend on the scheme",
);

test("the body is a cover: a short page keeps its footer at the bottom edge and its main at the top", async ({
	page,
}) => {
	const width = 1280;
	const height = 2400;
	await page.setViewportSize({ width, height });
	for (const [route, gap] of [
		["/login", "xl"],
		["/forgot-password", "xl"],
		["/reset-password", "xl"],
		["/imprint/", "m-l"],
	] as const) {
		expect((await page.goto(route))?.status()).toBe(200);
		const header = await box(page, "body > header");
		const main = await box(page, "body > main");
		const heading = await box(page, "main h1");
		const footer = await box(page, "body > footer");
		expect(header.top).toBeCloseTo(space("s-m", width), 0);
		expect(footer.bottom).toBeCloseTo(height - space("s-m", width), 0);
		// The main grows to fill the rest; its content starts at its top, so the
		// sign-in form is never centred in the viewport.
		expect(main.top - header.bottom).toBeCloseTo(space(gap, width), 0);
		expect(footer.top - main.bottom).toBeCloseTo(space(gap, width), 0);
		expect(heading.top).toBeCloseTo(main.top, 0);
	}
});

// One column when narrow, two by two when wide, never three or four in a row:
// three 18rem columns need more than the 48rem page column, at any root size.
for (const fontSize of [16, 32]) {
	test(`the four services form one column or a 2 x 2 grid from 320px to 1920px at a ${fontSize}px default font size`, async ({
		page,
	}) => {
		await (await page.context().newCDPSession(page)).send("Page.setFontSizes", {
			fontSizes: { standard: fontSize },
		});
		expect((await page.goto("/"))?.status()).toBe(200);
		const columns = new Set<number>();
		for (let width = 320; width <= 1920; width += 16) {
			await page.setViewportSize({ width, height: 900 });
			const services = await boxes(page, "main article");
			expect(services).toHaveLength(4);
			const lefts = new Set(services.map(({ left }) => Math.round(left)));
			const tops = new Set(services.map(({ top }) => Math.round(top)));
			columns.add(lefts.size);
			expect
				.soft([lefts.size, tops.size], `${width}px`)
				.toEqual(lefts.size === 1 ? [1, 4] : [2, 2]);
		}
		expect([...columns].sort()).toEqual([1, 2]);
	});
}

test("the landing prose keeps to the measure", async ({ page }) => {
	await page.setViewportSize({ width: 1600, height: 900 });
	expect((await page.goto("/"))?.status()).toBe(200);
	// The measure in px, resolved from the body text's ch.
	const measure = Number.parseFloat(
		await page
			.locator("main > section > p")
			.first()
			.evaluate((element) => getComputedStyle(element).maxInlineSize),
	);
	for (const { width } of await boxes(
		page,
		"main > section > p, .lede, .reasons",
	)) {
		expect(width).toBeLessThanOrEqual(measure + 0.5);
	}
	expect(
		Math.max(
			...(await boxes(page, "main > section > p")).map(({ width }) => width),
		),
	).toBeCloseTo(measure, 0);
});

// The password toggle and the reset link sit at the two ends of one line and
// drop below each other whole when the line is too short; neither text wraps.
for (const fontSize of [16, 32]) {
	test(`the login's password extras wrap as whole items at a ${fontSize}px default font size`, async ({
		page,
	}) => {
		await (await page.context().newCDPSession(page)).send("Page.setFontSizes", {
			fontSizes: { standard: fontSize },
		});
		expect((await page.goto("/login"))?.status()).toBe(200);
		const lines = new Set<number>();
		for (const width of [320, 480, 768, 1280]) {
			await page.setViewportSize({ width, height: 900 });
			const [toggle, link] = await Promise.all(
				[
					page.getByRole("button", { name: "Show password" }),
					page.getByRole("link", { name: "Forgot password?" }),
				].map((locator) =>
					locator.evaluate((element) => {
						const { top, left, right, height } =
							element.getBoundingClientRect();
						const range = document.createRange();
						range.selectNodeContents(element);
						const rows = new Set(
							[...range.getClientRects()].map(({ top }) => Math.round(top)),
						).size;
						return { top, left, right, height, rows };
					}),
				),
			);
			if (!toggle || !link) throw new Error("no password extras");
			expect([toggle.rows, link.rows], `${width}px`).toEqual([1, 1]);
			const field = await box(page, "#password");
			expect(toggle.left).toBeCloseTo(field.left, 0);
			if (Math.abs(toggle.top - link.top) < toggle.height) {
				lines.add(1);
				expect(link.right).toBeCloseTo(field.right, 0);
			} else {
				lines.add(2);
				expect(link.left).toBeCloseTo(field.left, 0);
			}
		}
		expect([...lines]).toContain(1);
	});
}
