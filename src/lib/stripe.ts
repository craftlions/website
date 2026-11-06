import { inArray, type SQLWrapper, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { stripeInvoices } from "./schema.ts";

// Core joins with public.invoices need this: both tables are named "invoices".
export const liveInvoices = alias(stripeInvoices, "live_invoices");

const zeroDecimalCurrencies = [
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
];

export const stripeInvoiceTotal = (
	invoice: Record<"currency" | "minorTotal", SQLWrapper>,
) =>
	sql<number>`(${invoice.minorTotal}::numeric / CASE WHEN ${inArray(sql`upper(${invoice.currency})`, zeroDecimalCurrencies)} THEN 1 ELSE 100 END)::float8`;

export const stripeInvoiceFields = {
	columns: {
		id: true,
		number: true,
		status: true,
		currency: true,
		invoicedAt: true,
		dueAt: true,
		paidAt: true,
	},
	extras: {
		total: stripeInvoiceTotal,
		paymentPage: (invoice: typeof stripeInvoices) =>
			sql<string>`coalesce(${invoice.hostedInvoiceUrl}, ${invoice.invoicePdf})`,
	},
} as const;

// Drafts are unnumbered and not yet sent, so no surface shows them.
export const organizationStripeInvoices = (organizationId: string) => ({
	status: { ne: "draft" },
	metadata: { organizationId },
});
