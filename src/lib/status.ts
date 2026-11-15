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

// "To send (1), In work (2)": how many phases are in each state with this
// badge, in lifecycle order; empty when there are none. "info" lists the
// admin's move, "gray" what waits on the client.
export const phaseStateSummary = (
	phases: ReadonlyArray<{ state: PhaseState }>,
	badge: BadgeType,
) =>
	(Object.keys(phaseStatus) as PhaseState[])
		.filter((state) => phaseStatus[state].badge === badge)
		.flatMap((state) => {
			const count = phases.filter((phase) => phase.state === state).length;
			return count > 0 ? [`${phaseStatus[state].label} (${count})`] : [];
		})
		.join(", ");

// Targets of the admin `transitionPhase` action: the states each one starts
// from, its button label and the event it records. `transitionPhaseAsAdmin`
// (admin-mutations.ts) enforces this table and the UI offers it, so both
// always agree. Delivery is recorded by its own action, so `in_progress` has
// no transition here. This module has no runtime imports, so it stays safe
// for browser scripts.
export const phaseTransitions = {
	planned: { from: ["submitted"], label: "Send to client", event: "planned" },
	approved: {
		from: ["planned"],
		label: "Approve for client",
		event: "approved_on_behalf",
	},
	in_progress: { from: ["approved"], label: "Start work", event: "started" },
	// Acceptance is explicit: only a delivered phase can be accepted.
	accepted: {
		from: ["delivered"],
		label: "Record acceptance",
		event: "accepted_on_behalf",
	},
	cancelled: {
		from: ["submitted", "planned"],
		label: "Cancel phase",
		event: "cancelled",
	},
} as const satisfies Record<
	string,
	{ from: readonly PhaseState[]; label: string; event: string }
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

export type ProjectTransitionEvent =
	| "activated"
	| "completed"
	| "reopened"
	| "archived";

// The project transitions open from each state, with the event each records.
// `transitionProject` (admin-mutations.ts) accepts exactly these pairs and the
// UI offers them, so both always agree.
export const projectTransitions: Record<
	ProjectState,
	ReadonlyArray<{
		nextState: ProjectTransitionTarget;
		label: string;
		event: ProjectTransitionEvent;
	}>
> = {
	draft: [{ nextState: "active", label: "Activate", event: "activated" }],
	active: [{ nextState: "completed", label: "Complete", event: "completed" }],
	completed: [
		{ nextState: "active", label: "Reopen", event: "reopened" },
		{ nextState: "archived", label: "Archive", event: "archived" },
	],
	archived: [],
};

const memberRoleLabel: Record<string, string> = {
	owner: "Owner",
	admin: "Admin",
	member: "Member",
};

// A member's role in an organization; the role column is free text, so any
// other value reads as Member. Roles are not states, so every badge is gray.
export const memberRole = (
	role: string,
): { label: string; badge: BadgeType } => ({
	label: memberRoleLabel[role] ?? "Member",
	badge: "gray",
});

export const costPartLabel: Record<InvoiceComponent, string> = {
	upfront: "Upfront",
	delivery: "Delivery",
	acceptance: "Acceptance",
};

export const isInvoiceOverdue = (
	invoice: { status: string; dueAt: Date | null },
	now = new Date(),
) => invoice.status === "open" && invoice.dueAt !== null && invoice.dueAt < now;

// Whole days an invoice is overdue, at least 1 once it is overdue, so an
// invoice that fell due today never reads "0 days overdue"; 0 otherwise.
export const daysOverdue = (
	invoice: { status: string; dueAt: Date | null },
	now = new Date(),
) =>
	isInvoiceOverdue(invoice, now) && invoice.dueAt
		? Math.max(
				1,
				Math.floor((now.getTime() - invoice.dueAt.getTime()) / 86_400_000),
			)
		: 0;

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
		// An open invoice waits on the client, so it is gray, not info.
		badge: invoice.status === "paid" ? "success" : "gray",
		overdue: false,
	};
};
