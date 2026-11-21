import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { expect, type Page, test } from "@playwright/test";

const source = readFileSync("src/components/PhaseOverview.astro", "utf8");
const script = stripTypeScriptTypes(
	source.match(/<script>([\s\S]*)<\/script>/)?.[1] ?? "",
);
const style = source.match(/<style>([\s\S]*)<\/style>/)?.[1] ?? "";

const fixture = async (page: Page) => {
	await page.goto("/brand/specimen/");
	const styles = await page
		.locator("head link[rel=stylesheet], head style")
		.evaluateAll((elements) =>
			elements.map((element) => element.outerHTML).join(""),
		);
	await page.route("**/phase-overview-fixture", (route) =>
		route.fulfill({
			contentType: "text/html",
			body: `<!doctype html><html lang="en"><head><title>Fixture</title>${styles}<style>${style}</style></head><body>
<phase-overview><ol class="lines" aria-label="Phases">
<li id="phase-a" class="target" data-phase><div class="line-text"><h3>Discovery</h3></div>
<p class="line-figure"><span>30.000,00 €</span></p>
<div class="line-actions cluster"><button type="button" class="button disclosure" data-variant="quiet" aria-label="Details: Discovery" aria-expanded="false" aria-controls="phase-a-details" data-phase-toggle>Details</button></div>
<div id="phase-a-details" class="line-details stack" hidden><p>upfront billed on approval</p></div>
</li></ol></phase-overview>
<script type="module">${script}</script></body></html>`,
		}),
	);
};

test("a text fragment opens a closed payment schedule", async ({ page }) => {
	await fixture(page);
	const toggle = page.getByRole("button", { name: "Details: Discovery" });
	const panel = page.locator("#phase-a-details");

	await page.goto("/phase-overview-fixture");
	await expect(panel).toHaveAttribute("hidden", "until-found");
	await expect(toggle).toHaveAttribute("aria-expanded", "false");
	expect(await panel.boundingBox()).toMatchObject({ width: 0, height: 0 });

	await page.goto("/phase-overview-fixture#:~:text=billed%20on%20approval");
	await expect(panel).toBeVisible();
	await expect(panel).not.toHaveAttribute("hidden");
	await expect(toggle).toHaveAttribute("aria-expanded", "true");

	await toggle.click();
	await expect(panel).toHaveAttribute("hidden", "until-found");
	await expect(toggle).toHaveAttribute("aria-expanded", "false");
});

test("without beforematch a closed schedule stays plainly hidden", async ({
	page,
}) => {
	await page.addInitScript(() => {
		delete (HTMLElement.prototype as { onbeforematch?: unknown }).onbeforematch;
	});
	await fixture(page);
	const toggle = page.getByRole("button", { name: "Details: Discovery" });
	const panel = page.locator("#phase-a-details");

	await page.goto("/phase-overview-fixture#:~:text=billed%20on%20approval");
	await expect(panel).toHaveAttribute("hidden", "");
	await expect(panel).toBeHidden();
	await expect(toggle).toHaveAttribute("aria-expanded", "false");

	await toggle.click();
	await expect(panel).toBeVisible();
	await toggle.click();
	await expect(panel).toHaveAttribute("hidden", "");
});
