import type { Db } from "./database.ts";
import { eq, sql } from "drizzle-orm";
import { assertAdminUser, DomainError } from "./domain.ts";
import { invoices } from "./schema.ts";

export interface StripeInvoiceSnapshot {
	status: string | null;
	paidAt: Date | null;
	dueAt: Date | null;
	invoicedAt: Date;
	fetchedAt: Date;
}

interface StripeInvoiceResponse {
	currency?: string;
	status?: string;
	status_transitions?: {
		paid_at?: number | null;
	};
	created?: number;
	due_date?: number | null;
	total?: number;
}

interface StripeInvoiceListItem extends StripeInvoiceResponse {
	id?: string;
	number?: string | null;
	hosted_invoice_url?: string | null;
	invoice_pdf?: string | null;
}

type ImportableStripeInvoice = StripeInvoiceListItem & {
	id: string;
	number: string;
	currency: string;
	created: number;
};

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

export const stripeInvoiceSnapshot = (
	data: StripeInvoiceResponse,
): StripeInvoiceSnapshot => {
	if (data.created == null) {
		throw new DomainError(
			"StripeUnavailable",
			"Stripe invoice response is missing its creation date.",
		);
	}

	return {
		status: data.status ?? null,
		paidAt:
			data.status_transitions?.paid_at != null
				? new Date(data.status_transitions.paid_at * 1000)
				: null,
		dueAt: data.due_date != null ? new Date(data.due_date * 1000) : null,
		invoicedAt: new Date(data.created * 1000),
		fetchedAt: new Date(),
	};
};

const isImportableStripeInvoice = (
	item: StripeInvoiceListItem,
): item is ImportableStripeInvoice =>
	Boolean(
		item.id &&
			item.number &&
			item.currency &&
			item.status !== "draft" &&
			item.created != null &&
			(item.hosted_invoice_url || item.invoice_pdf),
	);

export const fetchStripeInvoice = async (input: {
	stripeId: string;
	stripeKey: string;
}): Promise<StripeInvoiceResponse> => {
	let response: Response;
	try {
		response = await fetch(
			`https://api.stripe.com/v1/invoices/${encodeURIComponent(input.stripeId)}`,
			{
				headers: {
					Authorization: `Bearer ${input.stripeKey}`,
				},
			},
		);
	} catch {
		throw new DomainError("StripeUnavailable", "Stripe is unreachable.");
	}

	if (response.status === 404) {
		throw new DomainError("Validation", "Stripe invoice not found.");
	}

	if (!response.ok) {
		throw new DomainError("StripeUnavailable", "Stripe status is unavailable.");
	}

	return (await response.json()) as StripeInvoiceResponse;
};

const stripeFields = (snapshot: StripeInvoiceSnapshot) => ({
	stripeStatus: snapshot.status,
	stripePaidAt: snapshot.paidAt,
	stripeDueAt: snapshot.dueAt,
	fetchedAt: snapshot.fetchedAt,
	invoicedAt: snapshot.invoicedAt,
});

export const refreshStripeInvoice = async (
	db: Db,
	input: { invoiceId: string; stripeKey: string },
) => {
	const invoice = await db.query.invoices.findFirst({
		columns: { id: true, stripeId: true, total: true },
		with: {
			phase: {
				columns: { currency: true },
			},
		},
		where: { id: input.invoiceId },
	});

	if (!invoice?.phase) {
		throw new DomainError("NotFound", "Invoice not found.");
	}

	const data = await fetchStripeInvoice({
		stripeId: invoice.stripeId,
		stripeKey: input.stripeKey,
	});

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

	await db
		.update(invoices)
		.set(stripeFields(stripeInvoiceSnapshot(data)))
		.where(eq(invoices.id, invoice.id));
};

export const importStripeInvoices = async (
	db: Db,
	actorId: string,
	input: { organizationId: string; stripeKey: string },
) => {
	const [, metadata] = await Promise.all([
		assertAdminUser(db, actorId),
		db.query.organizationMetadata.findFirst({
			columns: { stripeCustomerId: true },
			where: { organizationId: input.organizationId },
		}),
	]);

	if (!metadata?.stripeCustomerId) {
		throw new DomainError(
			"Validation",
			"No Stripe customer is linked to this organization.",
		);
	}

	const fetched: StripeInvoiceListItem[] = [];
	let startingAfter: string | undefined;

	do {
		const url = new URL("https://api.stripe.com/v1/invoices");
		url.searchParams.set("customer", metadata.stripeCustomerId);
		url.searchParams.set("limit", "100");
		if (startingAfter) url.searchParams.set("starting_after", startingAfter);

		const response = await fetch(url, {
			headers: { Authorization: `Bearer ${input.stripeKey}` },
		});

		if (!response.ok) {
			throw new DomainError(
				"StripeUnavailable",
				"Stripe invoices are unavailable.",
			);
		}

		const page = (await response.json()) as {
			data?: StripeInvoiceListItem[];
			has_more?: boolean;
		};
		fetched.push(...(page.data ?? []));
		startingAfter = page.has_more ? page.data?.at(-1)?.id : undefined;
	} while (startingAfter);

	const importable = fetched.filter(isImportableStripeInvoice);

	if (importable.length === 0) {
		return;
	}

	// One multi-row upsert instead of a transaction per invoice; existing rows
	// only refresh their Stripe fields.
	await db
		.insert(invoices)
		.values(
			importable.map((item) => ({
				publicId: crypto.randomUUID(),
				organizationId: input.organizationId,
				stripeId: item.id,
				invoiceNumber: item.number,
				stripePaymentPage: item.hosted_invoice_url ?? item.invoice_pdf ?? "",
				currency: item.currency.toUpperCase(),
				total: fromStripeMinorUnits(item.total ?? 0, item.currency),
				...stripeFields(stripeInvoiceSnapshot(item)),
			})),
		)
		.onConflictDoUpdate({
			target: invoices.stripeId,
			set: {
				stripeStatus: sql`excluded.stripe_status`,
				stripePaidAt: sql`excluded.stripe_paid_at`,
				stripeDueAt: sql`excluded.stripe_due_at`,
				fetchedAt: sql`excluded.fetched_at`,
				invoicedAt: sql`excluded.invoiced_at`,
			},
		});
};
