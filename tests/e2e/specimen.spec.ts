// P-6: the interactive primitives on /brand/specimen, which renders each in a
// light and a dark section inside `method="dialog"` forms that never navigate.
import { expect, type Page, test } from "@playwright/test";

// The section is named by its heading, the scheme capitalized.
const section = (page: Page, scheme: string) =>
	page.getByRole("region", {
		name: `${scheme[0]?.toUpperCase()}${scheme.slice(1)}`,
		exact: true,
	});

test.beforeEach(async ({ page }) => {
	await page.goto("/brand/specimen/");
});

for (const scheme of ["light", "dark"]) {
	test(`a confirmation in the ${scheme} section opens on the safe action`, async ({
		page,
	}) => {
		const trigger = section(page, scheme).getByRole("button", {
			name: "Remove Jane Doe",
		});
		const dialog = page.getByRole("dialog", {
			name: "Remove Jane Doe from Acme?",
		});
		await expect(trigger).toHaveAttribute("aria-haspopup", "dialog");

		await trigger.click();
		await expect(dialog).toBeVisible();
		await expect(dialog).toHaveAccessibleDescription(
			"Jane loses access to the Acme dashboard. Her account stays.",
		);
		await expect(page.locator("dialog:modal")).toHaveCount(1);
		await expect(
			dialog.getByRole("button", { name: "Keep member" }),
		).toBeFocused();

		// Enter activates the focused cancel, never the confirm.
		await page.keyboard.press("Enter");
		await expect(dialog).toBeHidden();
		await expect(trigger).toBeFocused();

		await trigger.click();
		await expect(dialog).toBeVisible();
		await page.keyboard.press("Escape");
		await expect(dialog).toBeHidden();
		await expect(trigger).toBeFocused();
	});
}

test("the cancel button closes the dialog and returns focus", async ({
	page,
}) => {
	const trigger = section(page, "light").getByRole("button", {
		name: "Approve for client",
	});
	const dialog = page.getByRole("dialog", {
		name: "Approve Discovery for the client?",
	});
	await trigger.click();
	await expect(dialog.getByRole("button", { name: "Go back" })).toBeFocused();
	await dialog.getByRole("button", { name: "Go back" }).click();
	await expect(dialog).toBeHidden();
	await expect(trigger).toBeFocused();
});

test("focus stays inside the open dialog", async ({ page }) => {
	await section(page, "light")
		.getByRole("button", { name: "Remove Jane Doe" })
		.click();
	const dialog = page.getByRole("dialog", {
		name: "Remove Jane Doe from Acme?",
	});
	await page.keyboard.press("Tab");
	await expect(
		dialog.getByRole("button", { name: "Remove member" }),
	).toBeFocused();
	await page.keyboard.press("Shift+Tab");
	await expect(
		dialog.getByRole("button", { name: "Keep member" }),
	).toBeFocused();
});

test("type-to-confirm accepts only the exact text", async ({ page }) => {
	const trigger = section(page, "light").getByRole("button", {
		name: "Delete client",
	});
	const dialog = page.getByRole("dialog", { name: "Delete Acme?" });
	const field = dialog.getByLabel("Type Acme to confirm");
	const confirm = dialog.getByRole("button", { name: "Delete client" });

	await trigger.click();
	await expect(
		dialog.getByRole("button", { name: "Keep client" }),
	).toBeFocused();
	await expect(field).toHaveAttribute("required");
	await expect(field).toHaveAttribute("title", "Type Acme exactly");

	await confirm.click();
	await expect(dialog).toBeVisible();
	await expect(field).toBeFocused();
	expect(
		await field.evaluate(
			(input: HTMLInputElement) => input.validity.valueMissing,
		),
	).toBe(true);

	await field.fill("acme");
	await confirm.click();
	await expect(dialog).toBeVisible();
	expect(
		await field.evaluate(
			(input: HTMLInputElement) => input.validity.patternMismatch,
		),
	).toBe(true);

	await field.fill("Acme");
	const submitted = field.evaluate(
		(input: HTMLInputElement) =>
			new Promise((resolve) =>
				input.form?.addEventListener("submit", () => resolve(true), {
					once: true,
				}),
			),
	);
	await confirm.click();
	await submitted;
	// The demo form sits outside the dialog, so `method="dialog"` closes nothing.
	await expect(page).toHaveURL("/brand/specimen/");
	await dialog.getByRole("button", { name: "Keep client" }).click();
	await expect(dialog).toBeHidden();
	await expect(trigger).toBeFocused();
});

// Signed out, the palette's search answers 401, so it offers only Sign in.
test("a text selection dragged onto the backdrop keeps the palette open", async ({
	page,
}) => {
	await page.keyboard.press("ControlOrMeta+k");
	const field = page.getByRole("combobox", { name: "Search" });
	await expect(field).toBeFocused();
	await field.fill("acme invoices");

	const box = await field.boundingBox();
	if (!box) throw new Error("The search field has no box");
	await page.mouse.move(box.x + box.width - 4, box.y + box.height / 2);
	await page.mouse.down();
	await page.mouse.move(8, 8, { steps: 4 });
	await page.mouse.up();
	await expect(page.getByRole("dialog", { name: "Search" })).toBeVisible();

	await page.mouse.click(8, 8);
	await expect(page.getByRole("dialog", { name: "Search" })).toBeHidden();
});

// Browsers without invoker commands ignore `command` and `commandfor`; the
// component opens and closes the dialog itself there.
test.describe("without invoker commands", () => {
	test.beforeEach(async ({ page }) => {
		await page.addInitScript(() => {
			delete (HTMLButtonElement.prototype as { commandForElement?: Element })
				.commandForElement;
			document.addEventListener("DOMContentLoaded", () => {
				for (const button of document.querySelectorAll("button[command]")) {
					button.removeAttribute("command");
					button.removeAttribute("commandfor");
				}
			});
		});
		await page.reload();
	});

	test("the dialog still opens, cancels and returns focus", async ({
		page,
	}) => {
		expect(
			await page.evaluate(
				() => "commandForElement" in HTMLButtonElement.prototype,
			),
		).toBe(false);
		await expect(page.locator("button[command]")).toHaveCount(0);

		const trigger = section(page, "light").getByRole("button", {
			name: "Approve for client",
		});
		const dialog = page.getByRole("dialog", {
			name: "Approve Discovery for the client?",
		});
		await trigger.click();
		await expect(page.locator("dialog:modal")).toHaveCount(1);
		await expect(dialog.getByRole("button", { name: "Go back" })).toBeFocused();
		await dialog.getByRole("button", { name: "Go back" }).click();
		await expect(dialog).toBeHidden();
		await expect(trigger).toBeFocused();

		await trigger.click();
		await expect(dialog).toBeVisible();
		await page.keyboard.press("Escape");
		await expect(dialog).toBeHidden();
		await expect(trigger).toBeFocused();
	});
});

test("a disclosure opens its form on the first field and cancel resets it", async ({
	page,
}) => {
	const toggle = section(page, "light")
		.getByRole("button", { name: "Add member" })
		.and(page.locator("[aria-expanded]"));
	const form = section(page, "light").getByRole("form", { name: "Add member" });
	await expect(form).toBeHidden();

	await toggle.click();
	await expect(toggle).toHaveAttribute("aria-expanded", "true");
	await expect(form).toBeVisible();
	await expect(form.getByLabel("Email")).toBeFocused();

	await form.getByLabel("Email").fill("jane@example.com");
	// The form posts to no dialog, so submitting neither navigates nor closes it.
	await form.getByRole("button", { name: "Add member" }).click();
	await expect(page).toHaveURL("/brand/specimen/");
	await expect(form).toBeVisible();

	await form.getByRole("button", { name: "Cancel" }).click();
	await expect(form).toBeHidden();
	await expect(toggle).toHaveAttribute("aria-expanded", "false");
	await expect(toggle).toBeFocused();

	await toggle.click();
	await expect(form.getByLabel("Email")).toHaveValue("");
	await toggle.click();
	await expect(form).toBeHidden();
});

test("a quiet disclosure shows and hides its row", async ({ page }) => {
	const toggle = section(page, "dark").getByRole("button", { name: "More" });
	const row = section(page, "dark").getByText(
		"A row's corrections and quiet destructive actions.",
	);
	await expect(toggle).toHaveAttribute("aria-expanded", "false");
	await expect(row).toBeHidden();
	await toggle.click();
	await expect(toggle).toHaveAttribute("aria-expanded", "true");
	await expect(row).toBeVisible();
	await toggle.click();
	await expect(row).toBeHidden();
});
