import type { Db } from "./database.ts";
import { eq } from "drizzle-orm";
import { assertAdminUser, DomainError } from "./admin-mutations.ts";
import { invoices } from "./schema.ts";
import { uuidV7FromDate } from "./uuid.ts";

type StripeTransaction = Parameters<Parameters<Db["transaction"]>[0]>[0];

export interface StripeInvoiceSnapshot {
	status: string | null;
	paidAt: Date | null;
	dueAt: Date | null;
	fetchedAt: Date;
}

interface StripeInvoiceResponse {
	currency?: string;
	status?: string;
	status_transitions?: {
		paid_at?: number | null;
	};
	due_date?: number | null;
	total?: number;
}

interface StripeInvoiceListItem extends StripeInvoiceResponse {
	id?: string;
	number?: string | null;
	created?: number;
	hosted_invoice_url?: string | null;
	invoice_pdf?: string | null;
}

type ImportableStripeInvoice = StripeInvoiceListItem & {
	id: string;
	number: string;
	currency: string;
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

const stripeInvoiceSnapshot = (
	data: StripeInvoiceResponse,
): StripeInvoiceSnapshot => ({
	status: data.status ?? null,
	paidAt: data.status_transitions?.paid_at
		? new Date(data.status_transitions.paid_at * 1000)
		: null,
	dueAt: data.due_date ? new Date(data.due_date * 1000) : null,
	fetchedAt: new Date(),
});

const isImportableStripeInvoice = (
	item: StripeInvoiceListItem,
): item is ImportableStripeInvoice =>
	Boolean(
		item.id &&
			item.number &&
			item.currency &&
			item.status !== "draft" &&
			(item.hosted_invoice_url || item.invoice_pdf),
	);

export const persistStripeInvoiceSnapshot = async (
	tx: StripeTransaction,
	input:
		| {
				invoiceId: string;
				snapshot: StripeInvoiceSnapshot;
		  }
		| {
				organizationId: string;
				stripeInvoice: ImportableStripeInvoice;
				snapshot: StripeInvoiceSnapshot;
		  },
) => {
	const stripeFields = {
		stripeStatus: input.snapshot.status,
		stripePaidAt: input.snapshot.paidAt,
		stripeDueAt: input.snapshot.dueAt,
		fetchedAt: input.snapshot.fetchedAt,
	};

	if ("invoiceId" in input) {
		await tx
			.update(invoices)
			.set(stripeFields)
			.where(eq(invoices.id, input.invoiceId));
		return;
	}

	await tx
		.insert(invoices)
		.values({
			id: input.stripeInvoice.created
				? uuidV7FromDate(new Date(input.stripeInvoice.created * 1000))
				: undefined,
			publicId: crypto.randomUUID(),
			organizationId: input.organizationId,
			invoiceNumber: input.stripeInvoice.number,
			stripeId: input.stripeInvoice.id,
			stripePaymentPage:
				input.stripeInvoice.hosted_invoice_url ??
				input.stripeInvoice.invoice_pdf ??
				"",
			currency: input.stripeInvoice.currency.toUpperCase(),
			total: fromStripeMinorUnits(
				input.stripeInvoice.total ?? 0,
				input.stripeInvoice.currency,
			),
			...stripeFields,
		})
		.onConflictDoUpdate({
			target: invoices.stripeId,
			set: stripeFields,
		});
};

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

	await db.transaction((tx) =>
		persistStripeInvoiceSnapshot(tx, {
			invoiceId: invoice.id,
			snapshot: stripeInvoiceSnapshot(data),
		}),
	);
};

export const importStripeInvoices = async (
	db: Db,
	actorId: string,
	input: { organizationId: string; stripeKey: string },
) => {
	await assertAdminUser(db, actorId);

	const metadata = await db.query.organizationMetadata.findFirst({
		columns: { stripeCustomerId: true },
		where: { organizationId: input.organizationId },
	});

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

	for (const item of fetched) {
		if (!isImportableStripeInvoice(item)) {
			continue;
		}

		await db.transaction((tx) =>
			persistStripeInvoiceSnapshot(tx, {
				organizationId: input.organizationId,
				stripeInvoice: item,
				snapshot: stripeInvoiceSnapshot(item),
			}),
		);
	}
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
