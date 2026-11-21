import type { InvoiceComponent } from "./phase-billing.ts";
import type { phaseSelectType, projectSelectType } from "./schema.ts";

export type BadgeType = "info" | "success" | "error" | "gray";
export type PhaseState = phaseSelectType["state"];
export type ProjectState = projectSelectType["state"];

export const phaseStatus: Record<
	PhaseState,
	{ label: string; badge: BadgeType }
> = {
	submitted: { label: "To send", badge: "info" },
	planned: { label: "Awaiting approval", badge: "gray" },
	approved: { label: "Ready to start", badge: "info" },
	in_progress: { label: "In work", badge: "info" },
	delivered: { label: "Awaiting acceptance", badge: "gray" },
	accepted: { label: "Accepted", badge: "success" },
	cancelled: { label: "Cancelled", badge: "error" },
};

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

export const phaseTransitions = {
	planned: { from: ["submitted"], label: "Send to client", event: "planned" },
	approved: {
		from: ["planned"],
		label: "Approve for client",
		event: "approved_on_behalf",
	},
	in_progress: { from: ["approved"], label: "Start work", event: "started" },
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

export const recordDeliveryLabel = "Record delivery";

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

const memberRoleLabel = new Map([
	["owner", "Owner"],
	["admin", "Admin"],
	["member", "Member"],
]);

export const memberRole = (
	role: string,
): { label: string; badge: BadgeType } => ({
	label: memberRoleLabel.get(role) ?? "Member",
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

const invoiceStatusLabel = new Map([
	["open", "Open"],
	["paid", "Paid"],
	["draft", "Draft"],
	["void", "Void"],
	["uncollectible", "Uncollectible"],
]);

export const invoiceStatus = (
	invoice: { status: string; dueAt: Date | null },
	now = new Date(),
): { label: string; badge: BadgeType; overdue: boolean } => {
	if (isInvoiceOverdue(invoice, now)) {
		return { label: "Overdue", badge: "error", overdue: true };
	}
	return {
		label: invoiceStatusLabel.get(invoice.status) ?? invoice.status,
		badge: invoice.status === "paid" ? "success" : "gray",
		overdue: false,
	};
};
