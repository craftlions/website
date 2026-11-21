import { expect, type Page, test } from "@playwright/test";

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
	await expect(page).toHaveURL("/brand/specimen/");
	await dialog.getByRole("button", { name: "Keep client" }).click();
	await expect(dialog).toBeHidden();
	await expect(trigger).toBeFocused();
});

const dialogTests = () => {
	test("the palette opens from its trigger, closes and returns focus", async ({
		page,
	}) => {
		const dialog = page.getByRole("dialog", { name: "Search" });
		const field = dialog.getByRole("combobox", { name: "Search" });
		for (const scheme of ["light", "dark"]) {
			const trigger = section(page, scheme).getByRole("button", {
				name: "Search",
			});
			await trigger.click();
			await expect(page.locator("dialog:modal")).toHaveCount(1);
			await expect(field).toBeFocused();
			await page.keyboard.press("Escape");
			await expect(dialog).toBeHidden();
			await expect(trigger).toBeFocused();

			await trigger.click();
			await expect(field).toBeFocused();
			await page.mouse.click(8, 8);
			await expect(dialog).toBeHidden();
			await expect(trigger).toBeFocused();

			await trigger.click();
			await dialog.getByRole("button", { name: "Close" }).click();
			await expect(dialog).toBeHidden();
			await expect(trigger).toBeFocused();
		}
	});

	test("a text selection dragged onto the backdrop keeps the palette open", async ({
		page,
	}) => {
		const trigger = section(page, "light").getByRole("button", {
			name: "Search",
		});
		const dialog = page.getByRole("dialog", { name: "Search" });
		const field = dialog.getByRole("combobox", { name: "Search" });
		await trigger.click();
		await field.fill("acme invoices");

		const box = await field.boundingBox();
		if (!box) throw new Error("The search field has no box");
		await page.mouse.move(box.x + box.width - 4, box.y + box.height / 2);
		await page.mouse.down();
		await page.mouse.move(8, 8, { steps: 4 });
		await page.mouse.up();
		await expect(dialog).toBeVisible();
		await expect(field).toBeFocused();

		await page.mouse.click(8, 8);
		await expect(dialog).toBeHidden();
		await expect(trigger).toBeFocused();
	});

	test("the shortcut toggles the palette and Enter follows the chosen option", async ({
		page,
	}) => {
		const trigger = section(page, "dark").getByRole("button", {
			name: "Search",
		});
		const dialog = page.getByRole("dialog", { name: "Search" });
		const field = dialog.getByRole("combobox", { name: "Search" });
		const option = dialog.getByRole("option", { name: "Sign in" });
		await trigger.focus();
		await page.keyboard.press("ControlOrMeta+k");
		await expect(field).toBeFocused();
		await page.keyboard.press("ControlOrMeta+k");
		await expect(dialog).toBeHidden();
		await expect(trigger).toBeFocused();

		await page.keyboard.press("ControlOrMeta+k");
		await expect(option).toHaveAttribute("aria-selected", "true");
		await expect(field).toHaveAttribute("aria-expanded", "true");
		await page.keyboard.press("ArrowDown");
		await expect(field).toHaveAttribute(
			"aria-activedescendant",
			(await option.getAttribute("id")) ?? "",
		);
		await page.keyboard.press("Enter");
		await expect(page).toHaveURL("/login?returnTo=%2Fbrand%2Fspecimen%2F");
	});

	test("a click on the backdrop keeps a confirmation open", async ({
		page,
	}) => {
		const trigger = section(page, "light").getByRole("button", {
			name: "Remove Jane Doe",
		});
		const dialog = page.getByRole("dialog", {
			name: "Remove Jane Doe from Acme?",
		});
		await trigger.click();
		await page.mouse.click(8, 8);
		await expect(dialog).toBeVisible();
		await page.keyboard.press("Escape");
		await expect(dialog).toBeHidden();
		await expect(trigger).toBeFocused();
	});
};

dialogTests();

test.describe("without invoker commands or closedby", () => {
	test.beforeEach(async ({ page }) => {
		await page.addInitScript(() => {
			delete (HTMLButtonElement.prototype as { commandForElement?: Element })
				.commandForElement;
			delete (HTMLDialogElement.prototype as { closedBy?: string }).closedBy;
			document.addEventListener("DOMContentLoaded", () => {
				for (const button of document.querySelectorAll("button[command]")) {
					button.removeAttribute("command");
					button.removeAttribute("commandfor");
				}
				for (const dialog of document.querySelectorAll("dialog[closedby]")) {
					dialog.removeAttribute("closedby");
				}
			});
		});
		await page.reload();
	});

	test("the page has neither feature", async ({ page }) => {
		expect(
			await page.evaluate(() => [
				"commandForElement" in HTMLButtonElement.prototype,
				"closedBy" in HTMLDialogElement.prototype,
			]),
		).toEqual([false, false]);
		await expect(page.locator("button[command], dialog[closedby]")).toHaveCount(
			0,
		);
	});

	dialogTests();

	test("the dialog still opens, cancels and returns focus", async ({
		page,
	}) => {
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
