// P-1: the public pages render their title, heading and landmarks, the nav
// offers a signed-out visitor only Login, and every link on them resolves.
import { expect, test } from "@playwright/test";
import { routes } from "../routes.ts";

const pages = [
	{
		path: "/",
		title: "craftlions | Freelance IT Services & Technical Advisory",
		heading: "Modern IT services drawn with care",
	},
	{
		path: "/changelog/",
		title: "craftlions | Changelog",
		heading: "Changelog",
	},
	{ path: "/imprint/", title: "craftlions | Impressum", heading: "Impressum" },
	{ path: "/login", title: "craftlions | Login", heading: "Sign in" },
	{
		path: "/forgot-password",
		title: "craftlions | Forgot Password",
		heading: "Reset password",
	},
	{
		path: "/reset-password",
		title: "craftlions | Reset Password",
		heading: "New password",
	},
];

for (const { path, title, heading } of pages) {
	test(`${path} renders its landmarks and a signed-out nav`, async ({
		page,
	}) => {
		expect((await page.goto(path))?.status()).toBe(200);
		await expect(page).toHaveTitle(title);
		await expect(page.getByRole("heading", { level: 1 })).toHaveText(heading);
		await expect(page.getByRole("banner")).toBeVisible();
		await expect(page.getByRole("main")).toBeVisible();
		await expect(page.getByRole("contentinfo")).toBeVisible();
		await expect(
			page.getByRole("navigation", { name: "Footer" }),
		).toBeVisible();

		const nav = page.getByRole("navigation", { name: "Primary" });
		await expect(
			nav.getByRole("link", { name: "craftlions home" }),
		).toHaveAttribute("href", "/");
		// On /, /changelog/ and /imprint/ the links come from a deferred island.
		await expect(nav.getByRole("link", { name: "Login" })).toHaveAttribute(
			"href",
			"/login",
		);
		await expect(nav.getByText("Loading…")).toHaveCount(0);
		await expect(nav.getByRole("listitem")).toHaveCount(1);
	});
}

test("the nav marks Login as the current page on /login", async ({ page }) => {
	await page.goto("/login");
	await expect(
		page
			.getByRole("navigation", { name: "Primary" })
			.getByRole("link", { name: "Login" }),
	).toHaveAttribute("aria-current", "page");
});

test("the specimen renders without the site chrome", async ({ page }) => {
	expect((await page.goto("/brand/specimen/"))?.status()).toBe(200);
	await expect(page).toHaveTitle("craftlions | Specimen");
	await expect(page.getByRole("heading", { level: 1 })).toHaveText("Specimen");
	await expect(page.getByRole("main")).toBeVisible();
	await expect(page.getByRole("navigation", { name: "Primary" })).toHaveCount(
		0,
	);
});

test("the landing page links its contact calls and describes the company", async ({
	page,
}) => {
	await page.goto("/");
	for (const name of [
		"Services for steady technical progress",
		"Software development",
		"Flexible and asynchronous",
		"Technical advisory and strategy",
		"Workshops and learning",
		"Why choose craftlions?",
	]) {
		await expect(page.getByRole("heading", { name })).toBeVisible();
	}
	for (const name of ["Start a project", "Discuss the work", "Get in touch"]) {
		await expect(page.getByRole("link", { name })).toHaveAttribute(
			"href",
			"mailto:alexander@craftlions.com",
		);
	}

	await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
		"href",
		"https://craftlions.com/",
	);
	await expect(page.locator('meta[name="description"]')).toHaveAttribute(
		"content",
		/.+/,
	);
	const graph = JSON.parse(
		(await page.locator('script[type="application/ld+json"]').textContent()) ??
			"",
	)["@graph"];
	expect(graph).toContainEqual(
		expect.objectContaining({
			"@type": "Organization",
			legalName: "craftlions UG (haftungsbeschränkt)",
		}),
	);
	expect(JSON.stringify(graph)).not.toMatch(/rating|review/i);
});

test("the footer links point to contact, profiles and the legal pages", async ({
	page,
}) => {
	await page.goto("/");
	const footer = page.getByRole("navigation", { name: "Footer" });
	for (const [name, href] of [
		["Contact", "mailto:alexander@craftlions.com"],
		["GitHub", "https://github.com/craftlions"],
		["LinkedIn", "https://www.linkedin.com/company/craftlions"],
		["Changelog", "/changelog/"],
		["Imprint", "/imprint/"],
	] as const) {
		await expect(footer.getByRole("link", { name })).toHaveAttribute(
			"href",
			href,
		);
	}

	await footer.getByRole("link", { name: "Changelog" }).click();
	await expect(page).toHaveURL("/changelog/");
	await expect(page.getByRole("heading", { level: 1 })).toHaveText("Changelog");

	await page.goBack();
	await footer.getByRole("link", { name: "Imprint" }).click();
	await expect(page).toHaveURL("/imprint/");
	await expect(page.getByRole("heading", { level: 1 })).toHaveText("Impressum");

	await page
		.getByRole("navigation", { name: "Primary" })
		.getByRole("link", { name: "craftlions home" })
		.click();
	await expect(page).toHaveURL("/");
});

test("the changelog lists its entries newest first", async ({ page }) => {
	await page.goto("/changelog/");
	const entries = page
		.getByRole("list", { name: "Website update timeline" })
		.getByRole("article");
	await expect(entries.getByRole("heading")).toHaveText([
		"Completed projects",
		"Budgets",
		"Phases",
		"Invoices",
	]);
	await expect(entries.first().locator("time")).toHaveAttribute(
		"datetime",
		"2026-06-03",
	);
	await expect(entries.first().locator("time")).toHaveText("June 3, 2026");
	await expect(entries.last().locator("time")).toHaveAttribute(
		"datetime",
		"2026-04-28",
	);
});

test("the imprint names the legal contact and the dispute body", async ({
	page,
}) => {
	await page.goto("/imprint/");
	await expect(
		page.getByRole("main").getByRole("link", {
			name: "alexander@craftlions.com",
		}),
	).toHaveCount(2);
	await expect(
		page.getByText("Universalschlichtungsstelle des Bundes"),
	).toBeVisible();
	await expect(
		page.locator('a[href*="ec.europa.eu/consumers/odr"]'),
	).toHaveCount(0);
});

for (const route of routes) {
	test(`every same-origin link on ${route} resolves`, async ({
		page,
		request,
	}) => {
		await page.goto(route);
		await expect(page.getByText("Loading…")).toHaveCount(0);
		const hrefs = await page
			.locator('a[href^="/"]')
			.evaluateAll((links) => [
				...new Set(
					links.map(
						(link) => new URL((link as HTMLAnchorElement).href).pathname,
					),
				),
			]);
		expect(hrefs.length).toBeGreaterThan(0);
		for (const href of hrefs) {
			expect((await request.get(href)).status(), href).toBe(200);
		}
	});
}
