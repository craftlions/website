export const invoiceComponents = ["upfront", "delivery", "acceptance"] as const;

export type InvoiceComponent = (typeof invoiceComponents)[number];
export type ComponentBillingStatus = "not_due" | "due" | "invoiced" | "paid";

export interface PhaseComponentItem {
	component: InvoiceComponent;
	amount: number;
	status: ComponentBillingStatus;
}

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

export const buildPhaseComponents = (input: {
	upfrontAmount: number | null;
	deliveryAmount: number | null;
	acceptanceAmount: number | null;
	events: readonly string[];
	invoices: ReadonlyArray<{
		component: string | null;
		stripeStatus: string | null;
	}>;
}): PhaseComponentItem[] => {
	const invoiceByComponent = new Map(
		input.invoices
			.filter(
				(
					inv,
				): inv is {
					component: InvoiceComponent;
					stripeStatus: string | null;
				} =>
					inv.component === "upfront" ||
					inv.component === "delivery" ||
					inv.component === "acceptance",
			)
			.map((inv) => [inv.component, inv]),
	);
	return invoiceComponents
		.map((component) => {
			const amount =
				component === "upfront"
					? input.upfrontAmount
					: component === "delivery"
						? input.deliveryAmount
						: input.acceptanceAmount;
			return amount === null
				? null
				: {
						component,
						amount,
						status: componentBillingStatus({
							component,
							events: input.events,
							invoice: invoiceByComponent.get(component) ?? null,
						}),
					};
		})
		.filter((item): item is PhaseComponentItem => item !== null);
};
