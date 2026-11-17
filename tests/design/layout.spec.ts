// The layout primitives in src/styles/layout.css on their /brand/specimen
// fixtures: each one sits in a narrow (20rem) and a wide (60rem) frame, and at
// 1280px both frames get their full width, so each test asserts what the
// primitive does with the room it gets, not at which breakpoint.
import { expect, type Locator, type Page, test } from "@playwright/test";
import { px, tokens } from "../../scripts/fluid-scale.js";
import { routes } from "../routes.ts";

const width = 1280;
const space = (name: string) => {
	const token = tokens.find((step) => step.name === `space-${name}`);
	if (!token) throw new Error(`no --space-${name}`);
	return px(token, width);
};

type Box = {
	left: number;
	right: number;
	top: number;
	bottom: number;
	width: number;
	height: number;
};

const item = <T>(list: T[], index: number) => {
	const found = list.at(index);
	if (found === undefined) throw new Error(`no item ${index}`);
	return found;
};

// The box of the element and of each child, in px.
const layout = (locator: Locator) =>
	locator.evaluate((element) => {
		const box = (node: Element) => {
			const { left, right, top, bottom, width, height } =
				node.getBoundingClientRect();
			return { left, right, top, bottom, width, height };
		};
		return { ...box(element), children: [...element.children].map(box) };
	});

// Each child's width at max-content, measured with the primitive's sizing
// switched off and then restored.
const maxContent = (locator: Locator) =>
	locator.evaluate((element) =>
		[...element.children].map((child) => {
			const { style } = child as HTMLElement;
			const before = style.cssText;
			style.cssText += ";flex: none; inline-size: max-content";
			const size = child.getBoundingClientRect().width;
			style.cssText = before;
			return size;
		}),
	);

// How many lines the boxes form: a box starts a new line when it begins below
// every box of the line before it, whatever their vertical alignment.
const lines = (boxes: Box[]) =>
	[...boxes]
		.sort((a, b) => a.top - b.top)
		.reduce<Box[]>((found, box) => {
			const last = found.at(-1);
			if (last && box.top < last.bottom) {
				last.bottom = Math.max(last.bottom, box.bottom);
			} else {
				found.push({ ...box });
			}
			return found;
		}, []).length;

const frame = (page: Page, fixture: string, name: string) =>
	page.locator(`[data-fixture="${fixture}"] [data-frame="${name}"]`);

test.beforeEach(async ({ page }, info) => {
	test.skip(
		info.project.name === "dark",
		"layout does not depend on the scheme",
	);
	await page.setViewportSize({ width, height: 900 });
	expect((await page.goto("/brand/specimen/"))?.status()).toBe(200);
});

test("frames take their width from the page layer", async ({ page }) => {
	for (const [name, rem] of [
		["narrow", 20],
		["wide", 60],
	] as const) {
		for (const size of await page
			.locator(`[data-frame="${name}"]`)
			.evaluateAll((frames) =>
				frames.map((node) => node.getBoundingClientRect().width),
			)) {
			expect(size).toBe(rem * 16);
		}
	}
});

test("stack: each stack spaces its children with its own step", async ({
	page,
}) => {
	for (const name of ["narrow", "wide"]) {
		const outer = frame(page, "stack", name).locator(".stack").first();
		const gaps = await outer.evaluate((element) =>
			[element, ...element.children].map((node) =>
				Number.parseFloat(getComputedStyle(node).rowGap),
			),
		);
		// data-space="l" outside; inside, data-space="2xs" and the default s,
		// never the outer step inherited.
		expect(gaps.map((gap) => gap.toFixed(2))).toEqual(
			["l", "2xs", "s"].map((step) => space(step).toFixed(2)),
		);
		const { children } = await layout(outer);
		expect(item(children, 1).top - item(children, 0).bottom).toBeCloseTo(
			space("l"),
			1,
		);
	}
});

test("box: padding inside a dashed line", async ({ page }) => {
	const styles = await frame(page, "box", "wide")
		.locator(".box")
		.evaluateAll((nodes) =>
			nodes.map((node) => {
				const style = getComputedStyle(node);
				return [
					Number.parseFloat(style.paddingInlineStart).toFixed(2),
					style.borderTopStyle,
					style.borderTopWidth,
				];
			}),
		);
	expect(styles).toEqual([
		[space("s").toFixed(2), "dashed", "1px"],
		[space("xs").toFixed(2), "dashed", "1px"],
	]);
});

// A box that is also a stack: data-padding sets the box's step and
// data-space the stack's, each without the other.
test("box and stack on one element take their own steps", async ({ page }) => {
	const steps = await frame(page, "box", "wide").evaluate((element) => {
		element.insertAdjacentHTML(
			"beforeend",
			'<div class="box stack" data-padding="xs" data-space="2xs"><p></p><p></p></div>',
		);
		const both = element.lastElementChild;
		if (!both) throw new Error("no box stack");
		const style = getComputedStyle(both);
		return [style.paddingInlineStart, style.rowGap].map((value) =>
			Number.parseFloat(value).toFixed(2),
		);
	});
	expect(steps).toEqual([space("xs").toFixed(2), space("2xs").toFixed(2)]);
});

test("center: fills a narrow frame and caps at its column in a wide one", async ({
	page,
}) => {
	for (const [name, cap] of [
		["narrow", Number.POSITIVE_INFINITY],
		["wide", 32 * 16],
	] as const) {
		const outer = await layout(frame(page, "center", name));
		const center = item(outer.children, 0);
		const room = outer.width - 2 * (space("s") + 1);
		expect(center.width).toBeCloseTo(Math.min(room, cap), 1);
		expect(center.left - outer.left).toBeCloseTo(outer.right - center.right, 1);
	}
});

test("cluster: wraps at the items' own widths without overflow", async ({
	page,
}) => {
	for (const [name, rows] of [
		["narrow", 3],
		["wide", 1],
	] as const) {
		const cluster = frame(page, "cluster", name).locator(".cluster");
		const box = await layout(cluster);
		expect(lines(box.children)).toBe(rows);
		const natural = await maxContent(cluster);
		box.children.forEach((child, index) => {
			expect(child.right).toBeLessThanOrEqual(box.right + 0.5);
			expect(Math.abs(child.width - item(natural, index))).toBeLessThan(1);
		});
	}
});

// Side by side only while the content side keeps its minimum share; stacked,
// both take the full width.
const sidebar = async (outer: Locator, content: number, minimum: number) => {
	const box = await layout(outer);
	if (lines(box.children) === 1) {
		expect(item(box.children, content).width).toBeGreaterThanOrEqual(
			box.width * minimum - 0.5,
		);
		return "row";
	}
	for (const child of box.children) {
		expect(child.width).toBeCloseTo(box.width, 1);
	}
	return "stacked";
};

test("with-sidebar: the dashboard switches when the content would get under 60%", async ({
	page,
}) => {
	const narrow = frame(page, "sidebar", "narrow").locator(".with-sidebar");
	const wide = frame(page, "sidebar", "wide").locator(".with-sidebar");
	expect(await sidebar(narrow, 0, 0.6)).toBe("stacked");
	expect(await sidebar(wide, 0, 0.6)).toBe("row");
	// The sidebar keeps its 20rem, give or take its 1/1000 share of the rest.
	expect(
		Math.abs(item((await layout(wide)).children, 1).width - 20 * 16),
	).toBeLessThan(1);
});

// The action's width beyond its max-content.
const growth = async (row: Locator) =>
	item((await layout(row)).children, 1).width - item(await maxContent(row), 1);

// In the narrow frame the heading and the action just about fit side by side,
// so either arrangement is right there, as long as it is a whole one.
test("with-sidebar: the action keeps its width beside a heading", async ({
	page,
}) => {
	for (const name of ["narrow", "wide"]) {
		const row = frame(page, "heading-row", name).locator(".with-sidebar");
		if ((await sidebar(row, 0, 0.5)) === "row") {
			expect(await growth(row)).toBeLessThan(1);
		} else {
			expect(name).toBe("narrow");
		}
	}
});

// A measure cap on the heading from the base layer, as element defaults will
// set it, must not hand its share of the row to the button; the same cap
// above the layout layer shows what the primitive prevents.
test("with-sidebar: a measure cap on the heading does not widen the action", async ({
	page,
}) => {
	const row = frame(page, "heading-row", "wide").locator(".with-sidebar");
	await page.addStyleTag({
		content:
			'@layer base { [data-fixture="heading-row"] h4 { max-inline-size: var(--measure) } }',
	});
	expect(await growth(row)).toBeLessThan(1);
	await page.addStyleTag({
		content:
			'@layer page { [data-fixture="heading-row"] h4 { max-inline-size: var(--measure) } }',
	});
	expect(await growth(row)).toBeGreaterThan(100);
});

// All children in one row or all stacked at full width, never in between.
const switched = async (outer: Locator) => {
	const box = await layout(outer);
	const count = lines(box.children);
	if (count === 1) return "row";
	expect(count).toBe(box.children.length);
	for (const child of box.children) {
		expect(child.width).toBeCloseTo(box.width, 1);
	}
	return "stacked";
};

test("switcher: all in a row or all stacked", async ({ page }) => {
	for (const [name, expected] of [
		["narrow", "stacked"],
		["wide", "row"],
	] as const) {
		for (const outer of await frame(page, "switcher", name)
			.locator(".switcher")
			.all()) {
			expect(await switched(outer)).toBe(expected);
		}
	}
	// The cost split takes the larger share of the row.
	const { children } = await layout(
		frame(page, "switcher", "wide").locator(".switcher").first(),
	);
	expect(item(children, 1).width).toBeGreaterThan(
		item(children, 0).width * 1.3,
	);
});

test("switcher: five or more children always stack", async ({ page }) => {
	const metrics = frame(page, "switcher", "wide").locator("dl.switcher");
	await metrics.evaluate((element) => {
		for (const child of [...element.children].slice(0, 2)) {
			element.appendChild(child.cloneNode(true));
		}
	});
	expect(await switched(metrics)).toBe("stacked");
});

test("cover: the first and last parts sit at the edges", async ({ page }) => {
	for (const name of ["narrow", "wide"]) {
		const covers = await frame(page, "cover", name).locator(".cover").all();
		expect(covers).toHaveLength(2);
		for (const cover of covers) {
			const box = await layout(cover);
			const edge = space("xs") + 1;
			expect(box.height).toBeGreaterThanOrEqual(12 * 16 - 0.5);
			expect(item(box.children, 0).top - box.top).toBeCloseTo(edge, 1);
			expect(box.bottom - item(box.children, -1).bottom).toBeCloseTo(edge, 1);
		}
	}
});

test("auto-grid: equal cells, as many columns as fit at 16rem", async ({
	page,
}) => {
	for (const [name, expected] of [
		["narrow", 1],
		["wide", 3],
	] as const) {
		const box = await layout(
			frame(page, "auto-grid", name).locator(".auto-grid"),
		);
		const gap = space("s");
		const columns = Math.max(
			1,
			Math.min(
				box.children.length,
				Math.floor((box.width + gap) / (16 * 16 + gap)),
			),
		);
		expect(columns).toBe(expected);
		expect(new Set(box.children.map(({ left }) => Math.round(left))).size).toBe(
			columns,
		);
		for (const child of box.children) {
			expect(child.width).toBeCloseTo(item(box.children, 0).width, 1);
			expect(child.right).toBeLessThanOrEqual(box.right + 0.5);
		}
	}
});

// A child a primitive sizes may shrink below its longest word: an unbreakable
// word added to it overflows the child's text, never the primitive, and the
// child's minimum is 0 rather than its content. The with-sidebar content side
// keeps its own minimum share, which the shared rule must not override.
test("primitive children shrink below their longest word", async ({ page }) => {
	for (const [fixture, name, outer, child] of [
		["stack", "narrow", ".stack", ":scope > :first-child"],
		["cluster", "narrow", ".cluster", ":scope > :first-child"],
		["sidebar", "narrow", ".with-sidebar", ":scope > :last-child"],
		["switcher", "narrow", ".switcher", ":scope > :first-child"],
		["auto-grid", "narrow", ".auto-grid", ":scope > :first-child"],
	] as const) {
		const result = await frame(page, fixture, name)
			.locator(outer)
			.first()
			.evaluate((element, selector) => {
				const target = element.querySelector(selector);
				if (!target) throw new Error(`no ${selector}`);
				target.insertAdjacentHTML(
					"beforeend",
					`<span>${"W".repeat(60)}</span>`,
				);
				return {
					overflow:
						target.getBoundingClientRect().right -
						element.getBoundingClientRect().right,
					minimum: getComputedStyle(target).minInlineSize,
				};
			}, child);
		expect(result.overflow, fixture).toBeLessThanOrEqual(0.5);
		expect(result.minimum, fixture).toBe("0px");
	}
	const content = await frame(page, "sidebar", "wide")
		.locator(".with-sidebar > :first-child")
		.evaluate((element) => getComputedStyle(element).minInlineSize);
	expect(content).toBe("60%");
});

// No Button on a page is wider than its text, the sign of a capped sibling
// handing over its share. The hint button is exempt: it is a fixed 24px
// square around one character, a target size (DESIGN.md#buttons).
for (const route of routes) {
	test(`${route} buttons keep their width`, async ({ page }) => {
		expect((await page.goto(route))?.status()).toBe(200);
		const wide = await page.locator("button, a").evaluateAll((elements) =>
			elements
				.filter(
					(element) =>
						element.checkVisibility() &&
						getComputedStyle(element).display.includes("grid") &&
						getComputedStyle(element).borderTopStyle === "dashed" &&
						!element.matches('[data-variant="hint"]'),
				)
				.flatMap((element) => {
					const { style } = element as HTMLElement;
					const size = element.getBoundingClientRect().width;
					const before = style.cssText;
					style.cssText += ";flex: none; inline-size: max-content";
					const natural = element.getBoundingClientRect().width;
					style.cssText = before;
					return size > natural + 1
						? [`${element.textContent?.trim()}: ${size}px > ${natural}px`]
						: [];
				}),
		);
		expect(wide).toEqual([]);
	});
}
