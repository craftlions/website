// P-3 and P-9: what a signed-out visitor gets from the protected areas, the
// login page's return path, the search API and the command palette.
import { expect, test } from "@playwright/test";

// The client and account pages send the visitor back after login; admin
// pages send a plain /login, since a return path may only name /dash or /settings.
for (const [path, location] of [
	["/dash", "/login?returnTo=%2Fdash"],
	["/dash/", "/login?returnTo=%2Fdash%2F"],
	["/dash/org/acme", "/login?returnTo=%2Fdash%2Forg%2Facme"],
	[
		"/dash/org/acme/invoices?x=1",
		"/login?returnTo=%2Fdash%2Forg%2Facme%2Finvoices%3Fx%3D1",
	],
	["/dash/org/acme/spend", "/login?returnTo=%2Fdash%2Forg%2Facme%2Fspend"],
	[
		"/dash/org/acme/project/some-id",
		"/login?returnTo=%2Fdash%2Forg%2Facme%2Fproject%2Fsome-id",
	],
	["/settings/profile", "/login?returnTo=%2Fsettings%2Fprofile"],
	["/admin", "/login"],
	["/admin/org/some-id", "/login"],
	["/admin/org/some-id/members?tab=x", "/login"],
	["/admin/org/some-id/projects/some-id", "/login"],
] as const) {
	test(`${path} sends a signed-out visitor to ${location}`, async ({
		page,
		request,
	}) => {
		const response = await request.get(path, { maxRedirects: 0 });
		expect(response.status()).toBe(302);
		expect(response.headers().location).toBe(location);

		await page.goto(path);
		await expect(page).toHaveURL(location);
		await expect(page.getByRole("heading", { level: 1 })).toHaveText("Sign in");
	});
}

test("a deep link keeps its fragment through the login redirect", async ({
	page,
}) => {
	await page.goto("/dash/org/acme/invoices#invoices");
	await expect(page).toHaveURL(
		"/login?returnTo=%2Fdash%2Forg%2Facme%2Finvoices#invoices",
	);
});

// The form carries the parsed return path that sign-in hands Better Auth.
for (const [returnTo, parsed] of [
	["/dash/org/acme/invoices?x=1", "/dash/org/acme/invoices?x=1"],
	["/settings/profile", "/settings/profile"],
	[undefined, "/dash"],
	["", "/dash"],
	["//evil.example/dash", "/dash"],
	["https://evil.example/dash", "/dash"],
	["javascript:alert(1)", "/dash"],
	["/admin", "/dash"],
	["/dashboard", "/dash"],
	["/login", "/dash"],
] as const) {
	test(`login keeps returnTo ${JSON.stringify(returnTo)} as ${parsed}`, async ({
		page,
	}) => {
		await page.goto(
			returnTo === undefined
				? "/login"
				: `/login?${new URLSearchParams({ returnTo })}`,
		);
		await expect(
			page.getByRole("form", { name: "Sign in form" }),
		).toHaveAttribute("data-return-to", parsed);
	});
}

test("search rejects a signed-out caller", async ({ request }) => {
	const response = await request.get("/api/search?q=acme");
	expect(response.status()).toBe(401);
	expect(response.headers()["content-type"]).toBe("application/problem+json");
	expect(await response.json()).toEqual({
		type: "about:blank",
		title: "Unauthorized",
		status: 401,
		detail: "Sign in to search.",
	});
});

// The session check comes first, so an overlong query is still a 401.
test("search checks the session before the query", async ({ request }) => {
	expect((await request.get(`/api/search?q=${"a".repeat(201)}`)).status()).toBe(
		401,
	);
});

// Without a session cookie Better Auth answers these without the database.
test("the auth API reports no session to a signed-out caller", async ({
	request,
}) => {
	const response = await request.get("/api/auth/get-session");
	expect(response.status()).toBe(200);
	expect(await response.json()).toBeNull();
	expect(await (await request.get("/api/auth/ok")).json()).toEqual({
		ok: true,
	});
	expect((await request.get("/api/auth/does-not-exist")).status()).toBe(404);
});

for (const path of ["/", "/changelog/", "/login", "/brand/specimen/"]) {
	test(`${path} ships no command palette`, async ({ page }) => {
		await page.goto(path);
		await expect(page.getByText("Loading…")).toHaveCount(0);
		await expect(page.getByRole("button", { name: "Search" })).toHaveCount(0);
		await page.keyboard.press("ControlOrMeta+k");
		await expect(page.getByRole("dialog")).toHaveCount(0);
		await expect(page.locator("command-palette")).toHaveCount(0);
	});
}
