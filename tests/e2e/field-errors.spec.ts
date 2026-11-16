// P-7: Field shows a constraint error once the user has changed and left the
// field, or tried to submit (:user-invalid), with aria-invalid, the message and
// aria-describedby in step, on the sign-in and password forms. Every test
// stops before the auth API, which needs the database.
import { expect, type Locator, type Page, test } from "@playwright/test";

const forms: {
	path: string;
	form: string;
	submit: string;
	fields: [string, ...string[]];
	invalid: { label: string; value: string };
	valid: string;
}[] = [
	{
		path: "/login",
		form: "Sign in form",
		submit: "Sign in",
		fields: ["Email address", "Password"],
		invalid: { label: "Email address", value: "not-an-email" },
		valid: "owner@example.com",
	},
	{
		path: "/forgot-password",
		form: "Forgot password form",
		submit: "Send reset link",
		fields: ["Email address"],
		invalid: { label: "Email address", value: "not-an-email" },
		valid: "owner@example.com",
	},
	{
		path: "/reset-password?token=dummy",
		form: "Reset password form",
		submit: "Reset password",
		fields: ["New password", "Confirm password"],
		invalid: { label: "New password", value: "short" },
		valid: "longpassword1",
	},
];

const field = (page: Page, label: string) =>
	page.getByLabel(label, { exact: true });

// The message is the field's description only while it is invalid.
const expectValid = async (input: Locator) => {
	await expect(input).toHaveAttribute("aria-invalid", "false");
	await expect(input).toHaveAccessibleDescription("");
	const error = input
		.page()
		.locator(`#${await input.getAttribute("id")}-error`);
	await expect(error).toBeEmpty();
	await expect(error).toBeHidden();
};

const expectInvalid = async (input: Locator) => {
	const message = await input.evaluate(
		(element: HTMLInputElement) => element.validationMessage,
	);
	expect(message).not.toBe("");
	await expect(input).toHaveAttribute("aria-invalid", "true");
	await expect(input).toHaveAccessibleDescription(message);
	await expect(
		input.page().locator(`#${await input.getAttribute("id")}-error`),
	).toHaveText(message);
};

for (const { path, form, submit, fields, invalid, valid } of forms) {
	test.describe(path, () => {
		const requests: string[] = [];

		test.beforeEach(async ({ page }) => {
			requests.length = 0;
			page.on("request", (request) => {
				if (new URL(request.url()).pathname.startsWith("/api/auth/")) {
					requests.push(request.url());
				}
			});
			await page.goto(path);
		});

		test.afterEach(() => {
			expect(requests).toEqual([]);
		});

		test("a pristine form shows no error", async ({ page }) => {
			for (const label of fields) {
				await expectValid(field(page, label));
			}
			// Focusing and leaving an untouched field is no interaction yet.
			await field(page, fields[0]).focus();
			await field(page, fields[0]).blur();
			await expectValid(field(page, fields[0]));
		});

		test("a field left invalid shows its error until it is corrected", async ({
			page,
		}) => {
			const input = field(page, invalid.label);
			await input.fill(invalid.value);
			await expectValid(input);
			await input.blur();
			await expectInvalid(input);
			for (const label of fields.filter((label) => label !== invalid.label)) {
				await expectValid(field(page, label));
			}

			await input.fill(valid);
			await expectValid(input);
		});

		test("submitting the empty form marks every required field", async ({
			page,
		}) => {
			await page
				.getByRole("form", { name: form })
				.getByRole("button", { name: submit })
				.click();
			await expect(field(page, fields[0])).toBeFocused();
			for (const label of fields) {
				await expectInvalid(field(page, label));
			}
		});
	});
}

test.describe("without scripts", () => {
	test.use({ javaScriptEnabled: false });

	for (const { path, form, submit, fields } of forms) {
		test(`${path} still blocks an empty submit`, async ({ page }) => {
			await page.goto(path);
			const before = page.url();
			await page
				.getByRole("form", { name: form })
				.getByRole("button", { name: submit })
				.click();
			await expect(field(page, fields[0])).toBeFocused();
			expect(page.url()).toBe(before);
			// The browser's own message reports it; nothing claims an error
			// that is not shown.
			await expect(field(page, fields[0])).not.toHaveAttribute("aria-invalid");
		});
	}
});

// The specimen renders a field as the server returns it after a rejection.
test("a server error stays until the value changes", async ({ page }) => {
	await page.goto("/brand/specimen/");
	const input = page.getByLabel("With error", { exact: true }).first();
	await expect(input).toHaveAttribute("aria-invalid", "true");
	await expect(input).toHaveAccessibleDescription(
		"Enter a valid email address.",
	);

	await input.focus();
	await input.blur();
	await expect(input).toHaveAttribute("aria-invalid", "true");
	await expect(input).toHaveAccessibleDescription(
		"Enter a valid email address.",
	);

	// Changed but still malformed, the browser's message replaces it.
	await input.fill("still-not-an-email");
	await input.blur();
	await expectInvalid(input);

	await input.fill("owner@example.com");
	await expectValid(input);
});
