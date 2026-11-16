// The inbox and ledger lines of src/styles/components/lines.css on their
// /brand/specimen fixtures, with each wide frame swept from 320 to 960px: the
// same structure at every width, every figure and group total on one end
// edge, the actions beside the figure or whole below it, and nothing wider
// than its line.
import { readFileSync } from "node:fs";
import { expect, type Locator, type Page, test } from "@playwright/test";

const widths = [320, 360, 400, 480, 560, 640, 704, 768, 880, 960];
const fixtures = [
	"lines-worklist",
	"lines-phases",
	"lines-invoices",
	"lines-projects",
];

test.beforeEach(async ({ page }, info) => {
	test.skip(
		info.project.name === "dark",
		"layout does not depend on the scheme",
	);
	await page.setViewportSize({ width: 1280, height: 900 });
	expect((await page.goto("/brand/specimen/"))?.status()).toBe(200);
});

const frame = (page: Page, fixture: string, name = "wide") =>
	page.locator(`[data-fixture="${fixture}"] [data-frame="${name}"]`);

const resize = (locator: Locator, width: number) =>
	locator.evaluate((element, size) => {
		(element as HTMLElement).style.inlineSize = `${size}px`;
	}, width);

// Every list in the frame, nested ones included, with the boxes of its
// lines and group headings and of their parts.
const measure = (locator: Locator) =>
	locator.evaluate((root) => {
		const box = (node: Element) => {
			const { left, right, top, bottom, width, height } =
				node.getBoundingClientRect();
			return { left, right, top, bottom, width, height };
		};
		return [...root.querySelectorAll(".lines")].map((list) => {
			const lines = [
				...list.querySelectorAll(
					":scope > li, :scope > :is(ul, ol) > li, :scope > :is(h2, h3, h4, h5, h6)",
				),
			].map((line) => {
				const style = getComputedStyle(line);
				const outer = box(line);
				const content = {
					left:
						outer.left +
						Number.parseFloat(style.borderInlineStartWidth) +
						Number.parseFloat(style.paddingInlineStart),
					right:
						outer.right -
						Number.parseFloat(style.borderInlineEndWidth) -
						Number.parseFloat(style.paddingInlineEnd),
				};
				const part = (selector: string) => {
					const found = line.querySelector(`:scope > ${selector}`);
					return found?.checkVisibility() ? box(found) : null;
				};
				const amount = line.querySelector(
					":scope > .line-figure > :not(.sr-only)",
				);
				// Everything inside the line but the details, whose own lines
				// are measured as their own list.
				const inside = [...line.querySelectorAll("*")].filter(
					(node) =>
						node.checkVisibility() &&
						!node.closest(".sr-only") &&
						node.closest(".line-details, li, h2, h3, h4, h5, h6") === line,
				);
				return {
					heading: /^H\d$/.test(line.tagName),
					content,
					scrolls: line.scrollWidth > line.clientWidth,
					text: part(":first-child"),
					figure: part(".line-figure"),
					amount: amount ? box(amount) : null,
					actions: part(".line-actions"),
					details: part(".line-details"),
					outside: inside
						.filter((node) => {
							const { left, right } = node.getBoundingClientRect();
							return left < content.left - 0.5 || right > content.right + 0.5;
						})
						.map((node) => node.outerHTML.slice(0, 80)),
				};
			});
			return { ledger: list.matches('[data-actions="below"]'), lines };
		});
	});

type Box = { left: number; right: number; top: number; bottom: number };

// Beside: on the figure's row, after it. Below: under the text and the
// figure, across the whole line.
const placement = (
	line: Awaited<ReturnType<typeof measure>>[number]["lines"][number],
) => {
	const { actions, text, figure, content } = line;
	if (!actions || !text) return "none";
	const above = Math.max(text.bottom, figure?.bottom ?? 0);
	if (
		actions.top >= above - 0.5 &&
		Math.abs(actions.left - content.left) < 0.5 &&
		Math.abs(actions.right - content.right) < 0.5
	) {
		return "below";
	}
	if (
		actions.top < (figure ?? text).bottom &&
		actions.left >= (figure ?? text).right
	) {
		return "beside";
	}
	return "split";
};

for (const fixture of fixtures) {
	test(`${fixture}: one end edge, whole actions, no overflow`, async ({
		page,
	}) => {
		const seen = new Set<string>();
		// Where lines of one list differ, some figures beside their text and
		// some below it, while the edge check above still held.
		const mixed: string[] = [];
		for (const width of widths) {
			await resize(frame(page, fixture), width);
			expect(
				await frame(page, fixture).evaluate(
					(node) => node.scrollWidth - node.clientWidth,
				),
				`${width}px frame`,
			).toBeLessThanOrEqual(0);
			for (const [index, list] of (
				await measure(frame(page, fixture))
			).entries()) {
				const where = `${width}px, list ${index}`;
				// Every amount and every group total ends on the same edge.
				const edges = list.lines.flatMap(({ figure }) =>
					figure ? [figure.right] : [],
				);
				for (const edge of edges) {
					expect(Math.abs(edge - (edges[0] ?? edge)), where).toBeLessThan(0.5);
				}
				const figures = new Set<string>();
				for (const line of list.lines) {
					if (line.figure && line.amount) {
						expect(
							Math.abs(line.amount.right - line.figure.right),
						).toBeLessThan(0.5);
					}
					// The figure sits beside the text, after it, or on a row of
					// its own below it; either way on the shared edge above.
					if (line.figure && line.text) {
						const beside =
							line.figure.top < line.text.bottom &&
							line.figure.left >= line.text.right - 0.5;
						const below = line.figure.top >= line.text.bottom - 0.5;
						expect(beside || below, where).toBe(true);
						if (!line.heading) figures.add(beside ? "beside" : "below");
					}
					// A line's text keeps 12rem, or the whole line where that is
					// less.
					if (line.text && !line.heading) {
						expect(
							line.text.right - line.text.left,
							where,
						).toBeGreaterThanOrEqual(
							Math.min(12 * 16, line.content.right - line.content.left) - 0.5,
						);
					}
					expect(line.scrolls, where).toBe(false);
					expect(line.outside, where).toEqual([]);
					if (line.details && line.actions) {
						expect(line.details.top, where).toBeGreaterThanOrEqual(
							line.actions.bottom - 0.5,
						);
					}
				}
				// Every line of a list places its actions the same way, and a
				// ledger always below.
				const states = new Set(
					list.lines.map(placement).filter((state) => state !== "none"),
				);
				expect([...states], where).not.toContain("split");
				expect(states.size, where).toBeLessThanOrEqual(1);
				if (list.ledger) expect([...states], where).not.toContain("beside");
				for (const state of states) seen.add(`${list.ledger}-${state}`);
				if (figures.size > 1) mixed.push(where);
			}
		}
		test.info().annotations.push({
			type: "figures beside and below in one list",
			description: mixed.join("; ") || "none",
		});
		// The sweep crosses the threshold of every inbox list.
		if (fixture === "lines-worklist" || fixture === "lines-phases") {
			expect([...seen]).toEqual(
				expect.arrayContaining(["false-beside", "false-below"]),
			);
		}
	});

	// Tab order is the DOM order; each next target sits below the last one or
	// to its right on the same row, whether the actions sit beside or below.
	test(`${fixture}: reading order follows the visual order`, async ({
		page,
	}) => {
		for (const width of widths) {
			await resize(frame(page, fixture), width);
			const targets = await frame(page, fixture)
				.locator(".lines")
				.first()
				.evaluate((list) =>
					[...list.querySelectorAll("a[href], button, input")]
						.filter((node) => node.checkVisibility())
						.map((node) => {
							const { left, right, top, bottom } = node.getBoundingClientRect();
							return { left, right, top, bottom, name: node.textContent };
						}),
				);
			targets.reduce<Box | undefined>((previous, target) => {
				if (previous) {
					const below = target.top >= previous.bottom - 1;
					const after =
						target.top < previous.bottom && target.left >= previous.right - 1;
					expect(below || after, `${width}px ${target.name}`).toBe(true);
				}
				return target;
			}, undefined);
		}
	});

	// WCAG 2.5.8: at least 24×24px, or a 24px circle on a smaller target
	// touches no other target and no other such circle; in the actions slot,
	// at least 24×24px without exception.
	test(`${fixture}: targets are at least 24px`, async ({ page }) => {
		for (const width of [320, 480, 960]) {
			await resize(frame(page, fixture), width);
			const failures = await frame(page, fixture).evaluate((root) => {
				const targets = [
					...root.querySelectorAll<HTMLElement>("a[href], button, input"),
				]
					.filter((node) => node.checkVisibility())
					.map((node) => {
						const box = node.getBoundingClientRect();
						return {
							html: node.outerHTML.slice(0, 80),
							box,
							small: box.width < 24 || box.height < 24,
							x: box.left + box.width / 2,
							y: box.top + box.height / 2,
						};
					});
				const reach = (x: number, y: number, box: DOMRect) =>
					Math.hypot(
						Math.max(box.left - x, 0, x - box.right),
						Math.max(box.top - y, 0, y - box.bottom),
					);
				return targets
					.filter(
						(target) =>
							target.small &&
							targets.some(
								(other) =>
									other !== target &&
									(other.small
										? Math.hypot(other.x - target.x, other.y - target.y) < 24
										: reach(target.x, target.y, other.box) < 12),
							),
					)
					.map(({ html, box }) => `${box.width}×${box.height} ${html}`);
			});
			expect(failures, `${width}px`).toEqual([]);
			// In the actions slot every control is 24px, quiet ones too.
			const small = await frame(page, fixture)
				.locator(".line-actions :is(a, button)")
				.evaluateAll((nodes) =>
					nodes
						.filter((node) => node.checkVisibility())
						.map((node) => node.getBoundingClientRect())
						.filter(({ width, height }) => width < 24 || height < 24)
						.map(({ width, height }) => `${width}×${height}`),
				);
			expect(small, `${width}px`).toEqual([]);
		}
	});
}

// A list without actions reserves no slot: every figure and the group
// total end on the line's own end edge at every width.
test("a list without actions ends its figures on the line's edge", async ({
	page,
}) => {
	for (const width of widths) {
		await resize(frame(page, "lines-projects"), width);
		for (const list of await measure(frame(page, "lines-projects"))) {
			for (const line of list.lines) {
				expect(line.actions, `${width}px`).toBeNull();
				if (line.figure) {
					expect(
						Math.abs(line.figure.right - line.content.right),
						`${width}px`,
					).toBeLessThan(0.5);
				}
			}
		}
	}
});

test("a long unbroken name wraps inside its text", async ({ page }) => {
	for (const width of [320, 400, 480]) {
		await resize(frame(page, "lines-worklist"), width);
		const title = frame(page, "lines-worklist").getByRole("link", {
			name: /^Datenmigrations/,
		});
		const { height, right, text } = await title.evaluate((node) => {
			const line = node.closest(".line-text");
			if (!line) throw new Error("no .line-text");
			return {
				height: node.getBoundingClientRect().height,
				right: node.getBoundingClientRect().right,
				text: line.getBoundingClientRect().right,
			};
		});
		expect(height).toBeGreaterThan(30);
		expect(right).toBeLessThanOrEqual(text + 0.5);
	}
});

test("details open across the line and keep the edge", async ({ page }) => {
	const fixture = frame(page, "lines-invoices");
	const toggle = fixture.getByRole("button", {
		name: "Details: invoice A-0042",
	});
	const details = fixture.locator(".line-details");
	await expect(details).toBeHidden();
	await toggle.click();
	await expect(toggle).toHaveAttribute("aria-expanded", "true");
	await expect(details).toBeVisible();
	const [list] = await measure(fixture);
	const line = list?.lines.find(({ details }) => details);
	expect(line?.details?.left).toBeCloseTo(line?.content.left ?? 0, 0);
	expect(line?.details?.right).toBeCloseTo(line?.content.right ?? 0, 0);
	await toggle.click();
	await expect(details).toBeHidden();
});

test("the pattern turns without a container or media query", () => {
	const css = readFileSync("src/styles/components/lines.css", "utf8");
	expect(css).not.toMatch(/@container|container-type/);
	expect(css).not.toMatch(/@media[^{]*width/);
});
