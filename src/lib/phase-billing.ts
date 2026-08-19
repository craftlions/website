import type { phaseSelectType } from "./schema.ts";

export const invoiceComponents = ["upfront", "delivery", "acceptance"] as const;

export type InvoiceComponent = (typeof invoiceComponents)[number];
export type ComponentBillingStatus = "not_due" | "due" | "invoiced" | "paid";

export interface PhaseComponentItem {
	component: InvoiceComponent;
	amount: number;
	status: ComponentBillingStatus;
}

// Due-ness derives from the phase's persisted state, never from the events
// table — events is an audit log and must not feed UI or domain state.
const dueStates: Record<
	InvoiceComponent,
	ReadonlySet<phaseSelectType["state"]>
> = {
	upfront: new Set(["approved", "in_progress", "delivered", "accepted"]),
	delivery: new Set(["delivered", "accepted"]),
	acceptance: new Set(["accepted"]),
};

export const isInvoiceComponentDue = (
	component: InvoiceComponent,
	state: phaseSelectType["state"],
) => dueStates[component].has(state);

export const componentBillingStatus = (input: {
	component: InvoiceComponent;
	state: phaseSelectType["state"];
	invoice?: { stripeStatus: string | null } | null;
}): ComponentBillingStatus => {
	// D-phase-billing-truth: the tagged invoice and Stripe outrank the trigger;
	// billing state is derived here and is never persisted on the component.
	if (input.invoice?.stripeStatus === "paid") return "paid";
	if (input.invoice) return "invoiced";
	return isInvoiceComponentDue(input.component, input.state)
		? "due"
		: "not_due";
};

export const buildPhaseComponents = (input: {
	upfrontAmount: number | null;
	deliveryAmount: number | null;
	acceptanceAmount: number | null;
	state: phaseSelectType["state"];
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
							state: input.state,
							invoice: invoiceByComponent.get(component) ?? null,
						}),
					};
		})
		.filter((item): item is PhaseComponentItem => item !== null);
};
