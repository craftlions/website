import assert from "node:assert/strict";
import { test } from "node:test";
import { formatMoney, sumByCurrency } from "../../src/lib/format.ts";
import {
	buildPhaseComponents,
	costPartsToInvoice,
} from "../../src/lib/phase-billing.ts";
import { daysOverdue, invoiceStatus } from "../../src/lib/status.ts";

const phase = {
	upfrontAmount: 7200,
	deliveryAmount: 12000,
	acceptanceAmount: 4800,
	state: "delivered" as const,
	invoices: [],
};

test("a part falls due with the phase state that triggers it", () => {
	assert.deepEqual(
		buildPhaseComponents(phase).map(({ component, status }) => [
			component,
			status,
		]),
		[
			["upfront", "due"],
			["delivery", "due"],
			["acceptance", "not_due"],
		],
	);
	assert.deepEqual(
		buildPhaseComponents({ ...phase, state: "planned" }).map(
			({ status }) => status,
		),
		["not_due", "not_due", "not_due"],
	);
});

test("a tagged invoice outranks the trigger, and Stripe's paid outranks it", () => {
	const parts = buildPhaseComponents({
		...phase,
		state: "planned",
		invoices: [
			{ component: "upfront", stripe: { status: "paid" } },
			{ component: "delivery", stripe: { status: "open" } },
			{ component: "acceptance", stripe: null },
		],
	});
	assert.deepEqual(
		parts.map(({ status }) => status),
		["paid", "invoiced", "invoiced"],
	);
});

test("a zero or missing amount is no part to bill", () => {
	assert.deepEqual(
		buildPhaseComponents({
			...phase,
			upfrontAmount: 0,
			acceptanceAmount: null,
		}).map(({ component }) => component),
		["delivery"],
	);
});

test("only due parts without an invoice are left to invoice", () => {
	assert.deepEqual(
		costPartsToInvoice({
			...phase,
			invoices: [{ component: "upfront", stripe: { status: "open" } }],
		}).map(({ component }) => component),
		["delivery"],
	);
});

test("an open invoice past its due date is overdue by whole days, at least 1", () => {
	const now = new Date("2026-11-17T12:00:00Z");
	const due = (iso: string) => ({ status: "open", dueAt: new Date(iso) });
	assert.equal(daysOverdue(due("2026-11-17T11:00:00Z"), now), 1);
	assert.equal(daysOverdue(due("2026-11-03T12:00:00Z"), now), 14);
	assert.equal(daysOverdue(due("2026-11-18T00:00:00Z"), now), 0);
	assert.equal(daysOverdue({ status: "open", dueAt: null }, now), 0);
	assert.equal(
		daysOverdue({ status: "paid", dueAt: new Date("2026-01-01") }, now),
		0,
	);
	assert.deepEqual(invoiceStatus(due("2026-11-03T12:00:00Z"), now), {
		label: "Overdue",
		badge: "error",
		overdue: true,
	});
	assert.deepEqual(invoiceStatus(due("2026-12-01T00:00:00Z"), now), {
		label: "Open",
		badge: "gray",
		overdue: false,
	});
	assert.equal(
		invoiceStatus({ status: "paid", dueAt: null }, now).badge,
		"success",
	);
	assert.equal(
		invoiceStatus({ status: "refunded", dueAt: null }, now).label,
		"refunded",
	);
});

test("amounts in several currencies are summed per currency, never added", () => {
	assert.equal(
		sumByCurrency([
			{ amount: 100, currency: "EUR" },
			{ amount: 50, currency: "USD" },
			{ amount: 23.5, currency: "EUR" },
		]),
		`${formatMoney(123.5, "EUR")} + ${formatMoney(50, "USD")}`,
	);
	assert.equal(sumByCurrency([]), formatMoney(0, "EUR"));
	assert.equal(sumByCurrency([], "USD"), formatMoney(0, "USD"));
});
