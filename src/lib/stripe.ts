import type { Db } from "./database.ts";
import { eq } from "drizzle-orm";
import { DomainError, updateStoredStripeStatus } from "./admin-mutations.ts";
import { invoices } from "./schema.ts";

interface StripeInvoiceResponse {
	currency?: string;
	status?: string;
	status_transitions?: {
		paid_at?: number | null;
	};
	total?: number;
}

const zeroDecimalCurrencies = new Set([
	"BIF",
	"CLP",
	"DJF",
	"GNF",
	"JPY",
	"KMF",
	"KRW",
	"MGA",
	"PYG",
	"RWF",
	"UGX",
	"VND",
	"VUV",
	"XAF",
	"XOF",
	"XPF",
]);

const fromStripeMinorUnits = (amount: number, currency: string) =>
	zeroDecimalCurrencies.has(currency.toUpperCase()) ? amount : amount / 100;

export const refreshStripeInvoice = async (
	db: Db,
	input: { invoiceId: string; stripeKey: string },
) => {
	const invoice = await db.query.invoices.findFirst({
		columns: { id: true, stripeId: true, total: true },
		with: {
			phase: {
				columns: { currency: true, state: true },
			},
		},
		where: { id: input.invoiceId },
	});

	if (!invoice?.phase) {
		throw new DomainError("NotFound", "Invoice not found.");
	}

	if (invoice.phase.state !== "invoiced") {
		throw new DomainError(
			"InvalidTransition",
			"Only invoiced-phase invoices can be refreshed.",
		);
	}

	const response = await fetch(
		`https://api.stripe.com/v1/invoices/${encodeURIComponent(invoice.stripeId)}`,
		{
			headers: {
				Authorization: `Bearer ${input.stripeKey}`,
			},
		},
	);

	if (!response.ok) {
		throw new DomainError("StripeUnavailable", "Stripe status is unavailable.");
	}

	const data = (await response.json()) as StripeInvoiceResponse;

	if (
		data.currency &&
		data.currency.toUpperCase() !== invoice.phase.currency.toUpperCase()
	) {
		throw new DomainError(
			"Validation",
			`Stripe currency ${data.currency.toUpperCase()} does not match ${invoice.phase.currency}.`,
		);
	}

	if (
		typeof data.total === "number" &&
		Math.abs(
			fromStripeMinorUnits(data.total, invoice.phase.currency) - invoice.total,
		) > 0.0001
	) {
		throw new DomainError(
			"Validation",
			"Stripe total does not match the recorded invoice total.",
		);
	}

	await updateStoredStripeStatus(db, {
		invoiceId: invoice.id,
		status: data.status ?? null,
		paidAt: data.status_transitions?.paid_at
			? new Date(data.status_transitions.paid_at * 1000)
			: null,
		fetchedAt: new Date(),
	});
};

export const refreshStaleStripeInvoices = async (
	db: Db,
	input: { invoiceIds: string[]; stripeKey: string },
) => {
	await Promise.allSettled(
		input.invoiceIds.map((invoiceId) =>
			refreshStripeInvoice(db, { invoiceId, stripeKey: input.stripeKey }),
		),
	);
};

export const markStripeRefreshAttempt = async (
	db: Db,
	input: { invoiceId: string },
) => {
	await db
		.update(invoices)
		.set({ fetchedAt: new Date() })
		.where(eq(invoices.id, input.invoiceId));
};
