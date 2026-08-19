export const invoiceComponents = ["upfront", "delivery", "acceptance"] as const;

export type InvoiceComponent = (typeof invoiceComponents)[number];
export type ComponentBillingStatus = "not_due" | "due" | "invoiced" | "paid";

const dueEvents: Record<InvoiceComponent, ReadonlySet<string>> = {
	upfront: new Set(["approved", "approved_on_behalf"]),
	delivery: new Set(["delivered"]),
	acceptance: new Set(["accepted", "accepted_on_behalf"]),
};

export const isInvoiceComponentDue = (
	component: InvoiceComponent,
	events: readonly string[],
) => events.some((event) => dueEvents[component].has(event));

export const componentBillingStatus = (input: {
	component: InvoiceComponent;
	events: readonly string[];
	invoice?: { stripeStatus: string | null } | null;
}): ComponentBillingStatus => {
	// D-phase-billing-truth: the tagged invoice and Stripe outrank the trigger;
	// billing state is derived here and is never persisted on the component.
	if (input.invoice?.stripeStatus === "paid") return "paid";
	if (input.invoice) return "invoiced";
	return isInvoiceComponentDue(input.component, input.events)
		? "due"
		: "not_due";
};
