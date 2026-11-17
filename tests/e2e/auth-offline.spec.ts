// The auth forms when their request never gets an answer, as when offline:
// the browser aborts it before the auth API, so no database is needed.
import { expect, test } from "@playwright/test";

for (const { path, form, fill, submit, message } of [
	{
		path: "/login",
		form: "Sign in form",
		fill: { "Email address": "owner@example.com", Password: "secret123" },
		submit: "Sign in",
		message: "alert" as const,
	},
	{
		path: "/forgot-password",
		form: "Forgot password form",
		fill: { "Email address": "owner@example.com" },
		submit: "Send reset link",
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
}
