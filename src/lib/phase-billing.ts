import type { phaseSelectType } from "./schema.ts";

export const invoiceComponents = ["upfront", "delivery", "acceptance"] as const;

export type InvoiceComponent = (typeof invoiceComponents)[number];
export type ComponentBillingStatus = "not_due" | "due" | "invoiced" | "paid";

export interface PhaseComponentItem {
	component: InvoiceComponent;
	amount: number;
	status: ComponentBillingStatus;
}

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
	invoice?: { stripe: { status: string } | null } | null;
}): ComponentBillingStatus => {
	if (input.invoice?.stripe?.status === "paid") return "paid";
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
		component: string;
		stripe: { status: string } | null;
	}>;
}): PhaseComponentItem[] => {
	const invoiceByComponent = new Map(
		input.invoices.map((invoice) => [invoice.component, invoice]),
	);
	return invoiceComponents
		.map((component) => {
			const amount = input[`${component}Amount`];
			return amount === null || amount === 0
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

export const costPartsToInvoice = (
	phase: Parameters<typeof buildPhaseComponents>[0],
) => buildPhaseComponents(phase).filter((part) => part.status === "due");
