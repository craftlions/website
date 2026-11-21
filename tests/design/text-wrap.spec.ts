import { expect, test } from "@playwright/test";

test("text-wrap reaches prose and headings only", async ({ page }) => {
	await page.goto("/");
	const style = (selector: string) =>
		page
			.locator(selector)
			.first()
			.evaluate((element) => getComputedStyle(element).textWrapStyle);
	expect(await style("main p")).toBe("pretty");
	expect(await style("footer li")).toBe("pretty");
	expect(await style("h1")).toBe("balance");
	expect(await style("body")).toBe("auto");
	expect(await style("main .button")).toBe("auto");
});
