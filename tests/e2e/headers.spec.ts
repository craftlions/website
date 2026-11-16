// P-1: the indexing and caching rules of src/lib/indexing.ts and the
// middleware, the sitemap, unknown routes and trailing slashes.
import { expect, test } from "@playwright/test";

// Anonymous answers on these paths: a page, a redirect to login or a 401.
const privateResponses = [
	["/login", 200],
	["/forgot-password", 200],
	["/reset-password", 200],
	["/dash", 302],
	["/dash/org/acme", 302],
	["/settings/profile", 302],
	["/admin", 302],
	["/admin/org/some-id/members", 302],
	["/api/search", 401],
	["/api/auth/get-session", 200],
] as const;

for (const [path, status] of privateResponses) {
	test(`${path} is noindex`, async ({ request }) => {
		const response = await request.get(path, { maxRedirects: 0 });
		expect(response.status()).toBe(status);
		expect(response.headers()["x-robots-tag"]).toBe("noindex");
	});
}

// The middleware sends no-store only where the answer depends on the session.
for (const [path] of privateResponses.filter(([path]) =>
	/^\/(dash|settings|admin|api)\b/.test(path),
)) {
	test(`${path} is not stored`, async ({ request }) => {
		const response = await request.get(path, { maxRedirects: 0 });
		expect(response.headers()["cache-control"]).toBe("no-store");
	});
}

for (const path of ["/", "/changelog/", "/imprint/"]) {
	test(`${path} is indexable and cacheable`, async ({ page }) => {
		const response = await page.goto(path);
		expect(response?.status()).toBe(200);
		expect(response?.headers()["x-robots-tag"]).toBeUndefined();
		expect(response?.headers()["cache-control"]).not.toContain("no-store");
		await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
	});
}

// Prerendered, so the middleware never sees it; the meta tag carries noindex.
test("the specimen is noindex through its meta tag", async ({ page }) => {
	await page.goto("/brand/specimen/");
	await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
		"content",
		"noindex",
	);
});

test("the sitemap lists only the public pages", async ({ request }) => {
	const index = await (await request.get("/sitemap-index.xml")).text();
	const sitemaps = [...index.matchAll(/<loc>([^<]+)<\/loc>/g)].map(
		([, loc]) => new URL(loc ?? "").pathname,
	);
	expect(sitemaps).toEqual(["/sitemap-0.xml"]);
	const sitemap = await (await request.get("/sitemap-0.xml")).text();
	expect(
		[...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(([, loc]) => loc).sort(),
	).toEqual([
		"https://craftlions.com/",
		"https://craftlions.com/changelog/",
		"https://craftlions.com/imprint/",
	]);
});

test("robots.txt allows crawling and names the sitemap", async ({
	request,
}) => {
	const response = await request.get("/robots.txt");
	expect(response.status()).toBe(200);
	const robots = await response.text();
	expect(robots).toMatch(/^Allow: \/$/m);
	expect(robots).toMatch(
		/^Sitemap: https:\/\/craftlions\.com\/sitemap-index\.xml$/m,
	);
	expect(robots).not.toMatch(/^Disallow:/m);
});

for (const path of ["/does-not-exist", "/changelog/missing", "/design"]) {
	test(`${path} is not found`, async ({ page }) => {
		expect((await page.goto(path))?.status()).toBe(404);
	});
}

// No page answers the section roots, so they are 404s that keep the
// section's headers; /settings/api went with the API keys.
for (const path of ["/settings", "/settings/api", "/api"]) {
	test(`${path} is a private 404`, async ({ request }) => {
		const response = await request.get(path, { maxRedirects: 0 });
		expect(response.status()).toBe(404);
		expect(response.headers()["x-robots-tag"]).toBe("noindex");
		expect(response.headers()["cache-control"]).toBe("no-store");
	});
}

// Prerendered pages live at their trailing-slash URL; the others answer both.
for (const [path, location] of [
	["/changelog", "/changelog/"],
	["/imprint", "/imprint/"],
	["/brand/specimen", "/brand/specimen/"],
	["/index.html", "/"],
] as const) {
	test(`${path} redirects to ${location}`, async ({ request }) => {
		const response = await request.get(path, { maxRedirects: 0 });
		expect(response.status()).toBe(307);
		expect(response.headers().location).toBe(location);
	});
}

for (const path of ["/login/", "/forgot-password/", "/reset-password/"]) {
	test(`${path} answers without a redirect`, async ({ request }) => {
		expect((await request.get(path, { maxRedirects: 0 })).status()).toBe(200);
	});
}
