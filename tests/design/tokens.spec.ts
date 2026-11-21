import { expect, test } from "@playwright/test";
import { px, tokens } from "../../scripts/fluid-scale.js";
import { routes } from "../routes.ts";

const constants = [10, 20];

for (const route of routes) {
	for (const width of [320, 1280]) {
		test(`${route} ${width}px`, async ({ page }, info) => {
			test.skip(
				info.project.name === "dark",
				"sizes do not depend on the scheme",
			);
			await page.setViewportSize({ width, height: 800 });
			expect((await page.goto(route))?.status()).toBe(200);
			const sizes = Object.fromEntries(
				tokens.map((token) => [token.name, px(token, width)]),
			);
			const report = await page.evaluate(
				({
					sizes,
					constants,
				}: {
					sizes: Record<string, number>;
					constants: number[];
				}) => {
					const steps = Object.entries(sizes);
					const step = (value: string, prefix: string, extra: number[]) => {
						const number = Math.abs(Number.parseFloat(value));
						return (
							value === "normal" ||
							number === 0 ||
							extra.includes(number) ||
							steps.some(
								([name, size]) =>
									name.startsWith(prefix) && Math.abs(size - number) <= 0.05,
							)
						);
					};
					const found = new Map<string, Set<string>>();
					const note = (issue: string, element: Element) => {
						const entry = found.get(issue) ?? new Set();
						entry.add(
							`${element.localName}${element.classList.length ? `.${[...element.classList].slice(0, 4).join(".")}` : ""}`,
						);
						found.set(issue, entry);
					};
					for (const element of document.querySelectorAll("body, body *")) {
						if (!element.checkVisibility()) continue;
						const style = getComputedStyle(element);
						if (!step(style.fontSize, "step-", [])) {
							note(`font-size ${style.fontSize}`, element);
						}
						for (const property of [
							"padding-top",
							"padding-right",
							"padding-bottom",
							"padding-left",
							"margin-top",
							"margin-bottom",
							"row-gap",
							"column-gap",
							"scroll-margin-top",
						]) {
							const value = style.getPropertyValue(property);
							if (!step(value, "space-", [1, ...constants])) {
								note(`${property} ${value}`, element);
							}
						}
						if (!["400", "600"].includes(style.fontWeight)) {
							note(`font-weight ${style.fontWeight}`, element);
						}
						if (style.borderRadius !== "0px") {
							note(`border-radius ${style.borderRadius}`, element);
						}
						if (style.boxShadow !== "none") note("box-shadow", element);
					}
					return [...found].map(
						([issue, elements]) =>
							`${issue}: ${elements.size} × ${[...elements].slice(0, 3).join(", ")}`,
					);
				},
				{ sizes, constants },
			);
			expect(report).toEqual([]);
		});
	}
}
