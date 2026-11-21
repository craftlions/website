import { expect, test } from "@playwright/test";
import { routes } from "../routes.ts";

for (const route of routes) {
	for (const width of [320, 1280]) {
		test(`${route} ${width}px`, async ({ page }) => {
			await page.setViewportSize({ width, height: 800 });
			expect((await page.goto(route))?.status()).toBe(200);
			await expect(page.getByText("Loading…")).toHaveCount(0);
			const failures = await page.evaluate(() => {
				const targets = [
					...document.querySelectorAll<HTMLElement>(
						"a[href], button, input:not([type=hidden]), select, textarea, [role=option]",
					),
				]
					.filter(
						(element) =>
							element.checkVisibility() &&
							!(
								getComputedStyle(element).display === "inline" &&
								[...(element.parentElement?.childNodes ?? [])].some(
									(node) =>
										node.nodeType === Node.TEXT_NODE &&
										node.textContent?.trim(),
								)
							),
					)
					.map((element) => {
						const box = element.getBoundingClientRect();
						return {
							html: element.outerHTML.slice(0, 120),
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
			expect(failures).toEqual([]);
		});
	}
}
