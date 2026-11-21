import { expect, test } from "@playwright/test";

test("the request form validates the address before sending", async ({
	page,
}) => {
	const requests: string[] = [];
	page.on("request", (request) => {
		if (new URL(request.url()).pathname.startsWith("/api/auth/")) {
			requests.push(request.url());
		}
	});
	await page.goto("/forgot-password");
	const form = page.getByRole("form", { name: "Forgot password form" });
	const email = form.getByLabel("Email address");
	const submit = form.getByRole("button", { name: "Send reset link" });
	await expect(email).toHaveAttribute("type", "email");
	await expect(email).toHaveAttribute("required");

	await submit.click();
	await expect(email).toBeFocused();
	expect(
		await email.evaluate(
			(input: HTMLInputElement) => input.validity.valueMissing,
		),
	).toBe(true);

	await email.fill("not-an-email");
	await submit.click();
	expect(
		await email.evaluate(
			(input: HTMLInputElement) => input.validity.typeMismatch,
		),
	).toBe(true);

	await expect(submit).toHaveText("Send reset link");
	await expect(page.getByRole("status")).toBeEmpty();
	expect(requests).toEqual([]);
});

test("Back to sign in returns to the login", async ({ page }) => {
	await page.goto("/forgot-password");
	await page.getByRole("link", { name: "Back to sign in" }).click();
	await expect(page).toHaveURL("/login");
});

test("a reset link without a token offers a new one", async ({ page }) => {
	await page.goto("/reset-password");
	await expect(page.getByText("Invalid or missing reset token.")).toBeVisible();
	await expect(
		page.getByRole("form", { name: "Reset password form" }),
	).toBeHidden();
	await expect(page.getByLabel("New password")).toBeHidden();

	await page.getByRole("link", { name: "Request a new reset link" }).click();
	await expect(page).toHaveURL("/forgot-password");
});

test.describe("with a token", () => {
	const requests: string[] = [];

	test.beforeEach(async ({ page }) => {
		requests.length = 0;
		page.on("request", (request) => {
			if (new URL(request.url()).pathname.startsWith("/api/auth/")) {
				requests.push(request.url());
			}
		});
		await page.goto("/reset-password?token=dummy");
	});

	test.afterEach(() => {
		expect(requests).toEqual([]);
	});

	test("the form shows two labelled password fields", async ({ page }) => {
		await expect(page.getByText("Enter a new password below.")).toBeVisible();
		await expect(page.getByText("Invalid or missing reset token.")).toHaveCount(
			0,
		);
		for (const label of ["New password", "Confirm password"]) {
			const field = page.getByLabel(label);
			await expect(field).toHaveAttribute("type", "password");
			await expect(field).toHaveAttribute("autocomplete", "new-password");
			await expect(field).toHaveAttribute("minlength", "8");
			await expect(field).toHaveAttribute("required");
		}
	});

	test("a short password is blocked by the browser", async ({ page }) => {
		const password = page.getByLabel("New password");
		await password.pressSequentially("abc");
		await page.getByLabel("Confirm password").pressSequentially("abc");
		await page.getByRole("button", { name: "Reset password" }).click();
		await expect(password).toBeFocused();
		expect(
			await password.evaluate(
				(input: HTMLInputElement) => input.validity.tooShort,
			),
		).toBe(true);
		await expect(page.getByRole("status")).toBeEmpty();
	});

	test("different passwords mark the confirmation until they match", async ({
		page,
	}) => {
		const password = page.getByLabel("New password");
		const confirmation = page.getByLabel("Confirm password");
		await password.fill("longpassword1");
		await confirmation.fill("longpassword2");
		await page.getByRole("button", { name: "Reset password" }).click();
		await expect(confirmation).toBeFocused();
		await expect(confirmation).toHaveAttribute("aria-invalid", "true");
		await expect(confirmation).toHaveAccessibleDescription(
			"Passwords do not match.",
		);
		await expect(page.getByRole("status")).toBeEmpty();

		await password.fill("longpassword2");
		await expect(confirmation).toHaveAttribute("aria-invalid", "false");
		await expect(confirmation).toHaveAccessibleDescription("");

		await confirmation.fill("longpassword3");
		await expect(confirmation).toHaveAttribute("aria-invalid", "true");
		await confirmation.fill("longpassword2");
		await expect(confirmation).toHaveAttribute("aria-invalid", "false");
	});
});

test("Show passwords reveals both fields and submitting hides them", async ({
	page,
}) => {
	await page.route("**/api/auth/**", (route) => route.abort());
	await page.goto("/reset-password?token=dummy");
	const toggle = page.getByRole("button", { name: "Show passwords" });
	await expect(toggle).toHaveAttribute(
		"aria-controls",
		"password confirm-password",
	);
	await page.getByLabel("New password").fill("longpassword1");
	await page.getByLabel("Confirm password").fill("longpassword1");

	await toggle.click();
	await expect(toggle).toHaveAttribute("aria-pressed", "true");
	await expect(page.getByLabel("New password")).toHaveAttribute("type", "text");
	await expect(page.getByLabel("Confirm password")).toHaveAttribute(
		"type",
		"text",
	);

	await page.getByRole("button", { name: "Reset password" }).click();
	await expect(toggle).toHaveAttribute("aria-pressed", "false");
	await expect(page.getByLabel("New password")).toHaveAttribute(
		"type",
		"password",
	);
	await expect(page.getByLabel("Confirm password")).toHaveAttribute(
		"type",
		"password",
	);
});

test.describe("without scripts", () => {
	test.use({ javaScriptEnabled: false });

	for (const { path, form, fill, submit, message } of [
		{
			path: "/forgot-password",
			form: "Forgot password form",
			fill: { "Email address": "owner@example.com" },
			submit: "Send reset link",
			message:
				"Sending a reset link needs JavaScript. Turn it on and try again.",
		},
		{
			path: "/reset-password?token=dummy",
			form: "Reset password form",
			fill: {
				"New password": "longpassword1",
				"Confirm password": "longpassword1",
			},
			submit: "Reset password",
			message:
				"Resetting the password needs JavaScript. Turn it on and try again.",
		},
	]) {
		test(`${path} posts and says that it needs JavaScript`, async ({
			page,
		}) => {
			await page.goto(path);
			const element = page.getByRole("form", { name: form });
			await expect(element).toHaveAttribute("method", "post");
			for (const [label, value] of Object.entries(fill)) {
				await page.getByLabel(label).fill(value);
			}
			const request = page.waitForRequest(
				(request) => request.url() === new URL(path, page.url()).href,
			);
			await element.getByRole("button", { name: submit }).click();
			expect((await request).method()).toBe("POST");
			await expect(page.getByRole("status")).toHaveText(message);
			expect(page.url()).toBe(new URL(path, page.url()).href);
		});
	}
});
