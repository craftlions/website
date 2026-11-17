// Scans the routes in routes.ts with axe-core; the light and dark projects in
// playwright.config.ts run each route in both schemes, and each scheme once
// more with prefers-contrast: more. Axe tests only what is rendered, so the
// states a visitor opens are scanned once open: the specimen's disclosures,
// confirmations and palette, and the auth forms showing their errors.
// Every violation fails, best-practice included, so fix it instead of excluding it.
// What axe cannot decide (incomplete, "needs review") does not fail; each test
// attaches it as axe-incomplete.json and names the rules in an annotation, for
// a person to check. A clean scan is not proof of accessibility: keyboard,
// screen reader and zoom still need a person.
import { AxeBuilder } from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { routes } from "./routes.ts";

const tags = [
	"wcag2a",
	"wcag2aa",
	"wcag21a",
	"wcag21aa",
	"wcag22aa",
	"best-practice",
];
// Each exclusion names its rule and says why: { id: "rule-id", reason: "…" }.
const excluded: { id: string; reason: string }[] = [];

// Scans the page, or only what include selects, such as an open modal.
const scan = async (page: Page, include?: string) => {
	// Waits for the deferred nav island so the scan sees the final page.
	await expect(page.getByText("Loading…")).toHaveCount(0);
	const builder = new AxeBuilder({ page })
		.withTags(tags)
		.disableRules(excluded.map(({ id }) => id));
	const { violations, incomplete } = await (include
		? builder.include(include)
		: builder
	).analyze();
	if (incomplete.length > 0) {
		await test.info().attach("axe-incomplete.json", {
			contentType: "application/json",
			body: JSON.stringify(
				incomplete.map(({ id, impact, help, helpUrl, nodes }) => ({
					id,
					impact,
					help,
					helpUrl,
					nodes: nodes.map(({ target, failureSummary }) => ({
						target,
						failureSummary,
					})),
				})),
				null,
				2,
			),
		});
		test.info().annotations.push({
			type: "axe incomplete",
			description: incomplete
				.map(({ id, nodes }) => `${id} (${nodes.length})`)
				.join(", "),
		});
	}
	expect(violations).toEqual([]);
};

for (const route of routes) {
	for (const contrast of ["no-preference", "more"] as const) {
		test(
			contrast === "more" ? `${route} more contrast` : route,
			async ({ page }) => {
				await page.emulateMedia({ contrast });
				expect((await page.goto(route))?.status()).toBe(200);
				await scan(page);
			},
		);
	}
}

// The specimen's required fields, left malformed, show the browser's error
// on the danger line in both schemes.
test("/brand/specimen/ with fields left invalid", async ({ page }) => {
	await page.goto("/brand/specimen/");
	for (const input of await page
		.getByLabel("Required", { exact: true })
		.all()) {
		await input.fill("not-an-email");
		await input.blur();
		await expect(input).toHaveAttribute("aria-invalid", "true");
	}
	await scan(page);
});

test("/brand/specimen/ with every disclosure open", async ({ page }) => {
	await page.goto("/brand/specimen/");
	const closed = page.locator('button[aria-expanded="false"][aria-controls]');
	await expect(closed.first()).toBeVisible();
	while ((await closed.count()) > 0) {
		await closed.first().click();
	}
	await expect(page.locator('[aria-expanded="true"]').first()).toBeVisible();
	await scan(page);
});

for (const trigger of [
	"Remove Jane Doe",
	"Approve for client",
	"Delete client",
]) {
	test(`/brand/specimen/ with the ${trigger} confirmation open`, async ({
		page,
	}) => {
		await page.goto("/brand/specimen/");
		await page
			.getByRole("region", { name: "Light", exact: true })
			.getByRole("button", { name: trigger, exact: true })
			.click();
		await expect(page.locator("dialog:modal")).toBeVisible();
		await scan(page, "dialog[open]");
	});
}

test("/brand/specimen/ with a wrong type-to-confirm entry", async ({
	page,
}) => {
	await page.goto("/brand/specimen/");
	await page
		.getByRole("region", { name: "Light", exact: true })
		.getByRole("button", { name: "Delete client", exact: true })
		.click();
	const dialog = page.getByRole("dialog", { name: "Delete Acme?" });
	const field = dialog.getByLabel("Type Acme to confirm");
	await field.fill("acme");
	await dialog.getByRole("button", { name: "Delete client" }).click();
	await expect(field).toBeFocused();
	expect(
		await field.evaluate(
			(input: HTMLInputElement) => input.validity.patternMismatch,
		),
	).toBe(true);
	await scan(page, "dialog[open]");
});

test("/brand/specimen/ with the palette open on a query", async ({ page }) => {
	await page.goto("/brand/specimen/");
	await page
		.getByRole("region", { name: "Light", exact: true })
		.getByRole("button", { name: "Search", exact: true })
		.click();
	const dialog = page.getByRole("dialog", { name: "Search" });
	await dialog.getByRole("combobox", { name: "Search" }).fill("sign");
	await expect(dialog.getByRole("option").first()).toBeVisible();
	await scan(page, "dialog[open]");
});

// The auth forms submitted empty, with each required field marked, and with
// their request aborted before the auth API, as when offline.
for (const { path, form, submit, fill } of [
	{
		path: "/login",
		form: "Sign in form",
		submit: "Sign in",
		fill: { "Email address": "owner@example.com", Password: "secret123" },
	},
	{
		path: "/forgot-password",
		form: "Forgot password form",
		submit: "Send reset link",
		fill: { "Email address": "owner@example.com" },
	},
	{
		path: "/reset-password?token=dummy",
		form: "Reset password form",
		submit: "Reset password",
		fill: {
			"New password": "longpassword1",
			"Confirm password": "longpassword1",
		},
	},
]) {
	test(`${path} submitted empty`, async ({ page }) => {
		await page.goto(path);
		await page
			.getByRole("form", { name: form })
			.getByRole("button", { name: submit })
			.click();
		await expect(
			page.getByLabel(Object.keys(fill)[0] ?? "", { exact: true }),
		).toHaveAttribute("aria-invalid", "true");
		await scan(page);
	});

	test(`${path} when the server cannot be reached`, async ({ page }) => {
		await page.route("**/api/auth/**", (route) =>
			route.abort("internetdisconnected"),
		);
		await page.goto(path);
		for (const [label, value] of Object.entries(fill)) {
			await page.getByLabel(label, { exact: true }).fill(value);
		}
		await page
			.getByRole("form", { name: form })
			.getByRole("button", { name: submit })
			.click();
		await expect(
			page.getByText("Could not reach the server.", { exact: false }),
		).toBeVisible();
		await scan(page);
	});
}

test("/reset-password with passwords that differ", async ({ page }) => {
	await page.goto("/reset-password?token=dummy");
	await page.getByLabel("New password", { exact: true }).fill("longpassword1");
	const confirm = page.getByLabel("Confirm password", { exact: true });
	await confirm.fill("longpassword2");
	await confirm.blur();
	await expect(confirm).toHaveAttribute("aria-invalid", "true");
	await scan(page);
});
