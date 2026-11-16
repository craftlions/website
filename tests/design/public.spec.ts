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
