// prefers-contrast: more strengthens the quiet roles in tokens.css: muted text
// reaches 7:1 (WCAG 1.4.6), every dashed line and the control boundary 3:1
// (WCAG 1.4.11), on canvas and panel in the project's scheme, each stronger
// than without the preference; the chart's dimmed projects fade less.
import { expect, type Page, test } from "@playwright/test";
import { contrast } from "../../src/lib/contrast.ts";

const roles = {
	"fg-muted": 7,
	line: 3,
	"line-strong": 3,
	"line-control": 3,
	"line-active": 3,
	"line-success": 3,
	"line-info": 3,
};

// Each role and surface as the page computes it, as #rrggbb, and --dimmed.
const resolve = (page: Page) =>
	page.evaluate((names) => {
		const probe = document.body.appendChild(document.createElement("i"));
		const context = document.createElement("canvas").getContext("2d", {
			willReadFrequently: true,
		});
		const hex = (name: string) => {
			probe.style.color = `var(--${name})`;
			if (!context) return "";
			context.clearRect(0, 0, 1, 1);
			context.fillStyle = getComputedStyle(probe).color;
			context.fillRect(0, 0, 1, 1);
			return `#${Array.from(context.getImageData(0, 0, 1, 1).data.slice(0, 3))
				.map((channel) => channel.toString(16).padStart(2, "0"))
				.join("")}`;
		};
		const colors = Object.fromEntries(
			[...names, "canvas", "panel"].map((name) => [name, hex(name)]),
		);
		probe.remove();
		return {
			colors,
			dimmed: Number(
				getComputedStyle(document.documentElement).getPropertyValue("--dimmed"),
			),
		};
	}, Object.keys(roles));

test("prefers-contrast: more strengthens the quiet roles", async ({ page }) => {
	await page.goto("/");
	const normal = await resolve(page);
	await page.emulateMedia({ contrast: "more" });
	const more = await resolve(page);

	for (const [name, minimum] of Object.entries(roles)) {
		for (const surface of ["canvas", "panel"]) {
			const ratio = (found: typeof normal) =>
				contrast(found.colors[name] ?? "", found.colors[surface] ?? "");
			expect
				.soft(ratio(more), `${name} on ${surface}`)
				.toBeGreaterThanOrEqual(minimum);
			expect
				.soft(ratio(more), `${name} on ${surface}`)
				.toBeGreaterThan(ratio(normal));
		}
	}
	expect(more.dimmed).toBeGreaterThan(normal.dimmed);
});
