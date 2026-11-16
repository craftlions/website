// P-3: the sign-in form's behaviour before it reaches Better Auth. Signing in
// itself needs a user in the database and stays out of this suite.
import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
	await page.goto("/login");
});

test("the fields are labelled, required and filled in by the browser", async ({
	page,
}) => {
	const form = page.getByRole("form", { name: "Sign in form" });
	const email = form.getByLabel("Email address");
	const password = form.getByLabel("Password", { exact: true });
	await expect(email).toHaveAttribute("type", "email");
	await expect(email).toHaveAttribute("autocomplete", "username");
	await expect(email).toHaveAttribute("required");
	await expect(password).toHaveAttribute("type", "password");
	await expect(password).toHaveAttribute("autocomplete", "current-password");
	await expect(password).toHaveAttribute("required");
	await expect(form.getByRole("button", { name: "Sign in" })).toHaveAttribute(
		"type",
		"submit",
	);
	await expect(
		form.getByRole("link", { name: "Forgot password?" }),
	).toHaveAttribute("href", "/forgot-password");
	await expect(page.getByRole("alert")).toBeEmpty();
});

test("invalid input never reaches the auth API", async ({ page }) => {
	const requests: string[] = [];
	page.on("request", (request) => {
		if (new URL(request.url()).pathname.startsWith("/api/auth/sign-in")) {
			requests.push(request.url());
		}
	});
	const email = page.getByLabel("Email address");
	const submit = page.getByRole("button", { name: "Sign in" });

	await submit.click();
	await expect(email).toBeFocused();
	expect(
		await email.evaluate(
			(input: HTMLInputElement) => input.validity.valueMissing,
		),
	).toBe(true);

	await email.fill("not-an-email");
	await page.getByLabel("Password", { exact: true }).fill("secret123");
	await submit.click();
	await expect(email).toBeFocused();
	expect(
		await email.evaluate(
			(input: HTMLInputElement) => input.validity.typeMismatch,
		),
	).toBe(true);

	await email.fill("owner@example.com");
	await page.getByLabel("Password", { exact: true }).clear();
	await submit.click();
	await expect(page.getByLabel("Password", { exact: true })).toBeFocused();

	await expect(submit).toBeEnabled();
	await expect(submit).toHaveText("Sign in");
	await expect(page).toHaveURL("/login");
	expect(requests).toEqual([]);
});

test("Show password reveals and hides the password", async ({ page }) => {
	const password = page.getByLabel("Password", { exact: true });
	const toggle = page.getByRole("button", { name: "Show password" });
	await password.fill("secret123");
	await expect(toggle).toHaveAttribute("aria-pressed", "false");
	await expect(toggle).toHaveAttribute("aria-controls", "password");

	await toggle.click();
	await expect(password).toHaveAttribute("type", "text");
	await expect(toggle).toHaveAttribute("aria-pressed", "true");
	await expect(toggle).toHaveText("Show password");
	await expect(password).toHaveValue("secret123");

	await toggle.click();
	await expect(password).toHaveAttribute("type", "password");
	await expect(toggle).toHaveAttribute("aria-pressed", "false");
});

test("the form is in tab order", async ({ page }) => {
	await page.getByLabel("Email address").focus();
	for (const control of [
		page.getByLabel("Password", { exact: true }),
		page.getByRole("button", { name: "Show password" }),
		page.getByRole("link", { name: "Forgot password?" }),
		page.getByRole("button", { name: "Sign in" }),
	]) {
		await page.keyboard.press("Tab");
		await expect(control).toBeFocused();
	}
});

test("Forgot password? opens the reset request", async ({ page }) => {
	await page.getByRole("link", { name: "Forgot password?" }).click();
	await expect(page).toHaveURL("/forgot-password");
	await expect(page.getByRole("heading", { level: 1 })).toHaveText(
		"Reset password",
	);
});
