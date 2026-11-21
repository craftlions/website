import { expect, test } from "@playwright/test";

for (const { path, form, fill, submit, pending, message } of [
	{
		path: "/login",
		form: "Sign in form",
		fill: { "Email address": "owner@example.com", Password: "secret123" },
		submit: "Sign in",
		pending: "Signing in…",
		message: "alert" as const,
	},
	{
		path: "/forgot-password",
		form: "Forgot password form",
		fill: { "Email address": "owner@example.com" },
		submit: "Send reset link",
		pending: "Sending…",
		message: "status" as const,
	},
	{
		path: "/reset-password?token=dummy",
		form: "Reset password form",
		fill: {
			"New password": "longpassword1",
			"Confirm password": "longpassword1",
		},
		submit: "Reset password",
		pending: "Resetting…",
		message: "status" as const,
	},
]) {
	test(`${path} says it could not reach the server and can be retried`, async ({
		page,
	}) => {
		let attempts = 0;
		await page.route("**/api/auth/**", (route) => {
			attempts++;
			return route.abort("internetdisconnected");
		});
		await page.goto(path);
		for (const [label, value] of Object.entries(fill)) {
			await page.getByLabel(label, { exact: true }).fill(value);
		}
		const button = page
			.getByRole("form", { name: form })
			.getByRole("button", { name: submit });

		await button.click();
		await expect(page.getByRole(message)).toHaveText(
			"Could not reach the server. Check your connection and try again.",
		);
		await expect(button).toBeEnabled();
		await expect(button).toHaveText(submit);

		await button.click();
		await expect.poll(() => attempts).toBe(2);
		await expect(button).toBeEnabled();
	});

	test(`${path} sends one request while the first hangs`, async ({ page }) => {
		let attempts = 0;
		let release = () => {};
		const answered = new Promise<void>((resolve) => {
			release = resolve;
		});
		await page.route("**/api/auth/**", async (route) => {
			attempts++;
			await answered;
			await route.abort("internetdisconnected");
		});
		await page.goto(path);
		for (const [label, value] of Object.entries(fill)) {
			await page.getByLabel(label, { exact: true }).fill(value);
		}
		const button = page
			.getByRole("form", { name: form })
			.getByRole("button", { name: pending });

		await page.keyboard.press("Enter");
		await expect(button).toBeDisabled();
		await page.keyboard.press("Enter");
		await expect.poll(() => attempts).toBe(1);
		await expect(page.getByRole(message)).toBeEmpty();

		release();
		await expect(page.getByRole(message)).toHaveText(
			"Could not reach the server. Check your connection and try again.",
		);
		expect(attempts).toBe(1);
	});
}

test("/login returns focus to the email address when the server cannot be reached", async ({
	page,
}) => {
	await page.route("**/api/auth/**", (route) =>
		route.abort("internetdisconnected"),
	);
	await page.goto("/login");
	await page
		.getByLabel("Email address", { exact: true })
		.fill("owner@example.com");
	await page.getByLabel("Password", { exact: true }).fill("secret123");
	await page.getByRole("button", { name: "Sign in" }).click();
	await expect(page.getByRole("alert")).not.toBeEmpty();
	await expect(page.getByLabel("Email address", { exact: true })).toBeFocused();
});
