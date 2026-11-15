// Admin status vocabulary: one label, badge type and action name per state,
// used identically in badges, summaries, headings and copy.
//
// Badge colour rule: info = the admin has to act, gray = waiting on the
// client or inactive, success = done, error = overdue or cancelled.
import type { InvoiceComponent } from "./phase-billing.ts";
import type { phaseSelectType, projectSelectType } from "./schema.ts";

export type BadgeType = "info" | "success" | "error" | "gray";
export type PhaseState = phaseSelectType["state"];
export type ProjectState = projectSelectType["state"];

export const phaseStatus: Record<
	PhaseState,
	{ label: string; badge: BadgeType; action: string | null }
> = {
	submitted: { label: "To send", badge: "info", action: "Send to client" },
	planned: {
		label: "Awaiting approval",
		badge: "gray",
		action: "Approve for client",
	},
	approved: { label: "Ready to start", badge: "info", action: "Start work" },
	in_progress: { label: "In work", badge: "info", action: "Record delivery" },
	delivered: {
		label: "Awaiting acceptance",
		badge: "gray",
		action: "Record acceptance",
	},
	accepted: { label: "Accepted", badge: "success", action: null },
	cancelled: { label: "Cancelled", badge: "error", action: null },
};

// Targets of the admin `transitionPhase` action, with the states each one
// starts from (mirrors `phaseTransitions` in admin-mutations.ts). Delivery is
// recorded by its own action, so `in_progress` has no transition here.
export const phaseTransitions = {
	planned: { from: ["submitted"], label: "Send to client" },
	approved: { from: ["planned"], label: "Approve for client" },
	in_progress: { from: ["approved"], label: "Start work" },
	accepted: { from: ["delivered"], label: "Record acceptance" },
	cancelled: { from: ["submitted", "planned"], label: "Cancel phase" },
} as const satisfies Record<
	string,
	{ from: readonly PhaseState[]; label: string }
>;

export type PhaseTransitionTarget = keyof typeof phaseTransitions;

// Transitions open to the admin from a state, forward step first and
// cancellation last.
export const phaseTransitionsFrom = (state: PhaseState) =>
	(Object.keys(phaseTransitions) as PhaseTransitionTarget[]).filter((target) =>
		(phaseTransitions[target].from as readonly PhaseState[]).includes(state),
	);

export const projectStatus: Record<
	ProjectState,
	{ label: string; badge: BadgeType }
> = {
	draft: { label: "Draft", badge: "info" },
	active: { label: "Active", badge: "info" },
	completed: { label: "Completed", badge: "success" },
	archived: { label: "Archived", badge: "gray" },
};

export type ProjectTransitionTarget = "active" | "completed" | "archived";

// Mirrors the valid pairs in `transitionProject` (admin-mutations.ts).
export const projectTransitions: Record<
	ProjectState,
	ReadonlyArray<{ nextState: ProjectTransitionTarget; label: string }>
> = {
	draft: [{ nextState: "active", label: "Activate" }],
	active: [{ nextState: "completed", label: "Complete" }],
	completed: [
		{ nextState: "active", label: "Reopen" },
		{ nextState: "archived", label: "Archive" },
	],
	archived: [],
};

export const costPartLabel: Record<InvoiceComponent, string> = {
	upfront: "Upfront",
	delivery: "Delivery",
	acceptance: "Acceptance",
};

export const isInvoiceOverdue = (
	invoice: { status: string; dueAt: Date | null },
	now = new Date(),
) => invoice.status === "open" && invoice.dueAt !== null && invoice.dueAt < now;

const invoiceStatusLabel: Record<string, string> = {
	open: "Open",
	paid: "Paid",
	draft: "Draft",
	void: "Void",
	uncollectible: "Uncollectible",
};

export const invoiceStatus = (
	invoice: { status: string; dueAt: Date | null },
	now = new Date(),
): { label: string; badge: BadgeType; overdue: boolean } => {
	if (isInvoiceOverdue(invoice, now)) {
		return { label: "Overdue", badge: "error", overdue: true };
	}
	return {
		label: invoiceStatusLabel[invoice.status] ?? invoice.status,
		badge:
			invoice.status === "open"
				? "info"
				: invoice.status === "paid"
					? "success"
					: "gray",
		overdue: false,
	};
};
