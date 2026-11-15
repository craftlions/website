// The client worklist: what the organization dashboard lists for the client,
// split by who acts next. The client's wording deliberately differs from the
// admin vocabulary in status.ts.

import { formatDate, formatDays } from "./format.ts";
import {
	type BadgeType,
	daysOverdue,
	isInvoiceOverdue,
	type PhaseState,
} from "./status.ts";

// The client's own wording for a phase state, in sentence case.
export const clientPhaseLabel: Record<PhaseState, string> = {
	submitted: "Submitted",
	planned: "Planned",
	approved: "Approved",
	in_progress: "In progress",
	delivered: "Delivered",
	accepted: "Accepted",
	cancelled: "Cancelled",
};

// Phase states that are a worklist item, in priority order after overdue
// invoices: the client decides on planned and delivered phases, craftlions
// moves the others on. Open invoices rank between the two groups.
const worklistPhaseStates = {
	planned: { actor: "client", label: "To approve", priority: 1 },
	delivered: { actor: "client", label: "To review", priority: 2 },
	submitted: {
		actor: "craftlions",
		label: clientPhaseLabel.submitted,
		priority: 4,
	},
	approved: {
		actor: "craftlions",
		label: clientPhaseLabel.approved,
		priority: 5,
	},
	in_progress: {
		actor: "craftlions",
		label: clientPhaseLabel.in_progress,
		priority: 6,
	},
} as const satisfies Partial<
	Record<
		PhaseState,
		{ actor: "client" | "craftlions"; label: string; priority: number }
	>
>;

type WorklistProjectInput = {
	publicId: string;
	name: string;
	phases: ReadonlyArray<{
		publicId: string;
		title: string;
		state: PhaseState;
		dueAt: Date | null;
		cost: number;
		currency: string;
	}>;
};

type WorklistInvoiceInput = {
	id: string;
	number: string;
	status: string;
	total: number;
	currency: string;
	dueAt: Date | null;
	component: string | null;
	phase: {
		publicId: string;
		title: string;
		project: { publicId: string; name: string } | null;
	} | null;
};

type ItemBase = {
	// Unique per page, for keys and ids.
	key: string;
	actor: "client" | "craftlions";
	label: string;
	// info = the client acts, gray = craftlions acts, error = overdue.
	badge: BadgeType;
	// The phase on its project page; null for an invoice without a phase.
	href: string | null;
	priority: number;
	amount: number;
	currency: string;
	// The due date or days overdue, as labelled copy.
	due: string;
	overdue: boolean;
};

export type ClientWorklistItem<
	Project extends WorklistProjectInput,
	Invoice extends WorklistInvoiceInput,
> =
	| (ItemBase & {
			kind: "phase";
			project: Project;
			phase: Project["phases"][number];
	  })
	| (ItemBase & { kind: "invoice"; invoice: Invoice });

/**
 * Phases waiting on the client's decision and open invoices waiting on
 * payment ("client"), plus phases craftlions moves on next ("craftlions").
 * Overdue invoices first, then decisions, open invoices and craftlions'
 * phases; ties keep project and phase order, invoices oldest first.
 */
export const deriveClientWorklist = <
	Project extends WorklistProjectInput,
	Invoice extends WorklistInvoiceInput,
>(input: {
	slug: string;
	projects: ReadonlyArray<Project>;
	// Every invoice of the organization, newest first.
	invoices: ReadonlyArray<Invoice>;
	now?: Date;
}): ClientWorklistItem<Project, Invoice>[] => {
	const now = input.now ?? new Date();
	const phaseHref = (projectPublicId: string, phasePublicId: string) =>
		`/dash/org/${input.slug}/project/${projectPublicId}#phase-${phasePublicId}`;

	return [
		...input.projects.flatMap((project) =>
			project.phases.flatMap(
				(phase): ClientWorklistItem<Project, Invoice>[] => {
					const state =
						phase.state in worklistPhaseStates
							? worklistPhaseStates[
									phase.state as keyof typeof worklistPhaseStates
								]
							: undefined;
					return state
						? [
								{
									kind: "phase",
									key: `phase-${phase.publicId}`,
									actor: state.actor,
									label: state.label,
									badge: state.actor === "client" ? "info" : "gray",
									href: phaseHref(project.publicId, phase.publicId),
									priority: state.priority,
									amount: phase.cost,
									currency: phase.currency,
									due: phase.dueAt
										? `Due ${formatDate(phase.dueAt)}`
										: "Not scheduled",
									overdue: false,
									project,
									phase,
								},
							]
						: [];
				},
			),
		),
		...input.invoices
			.filter((invoice) => invoice.status === "open")
			.toReversed()
			.map((invoice): ClientWorklistItem<Project, Invoice> => {
				const overdue = isInvoiceOverdue(invoice, now);
				return {
					kind: "invoice",
					key: `invoice-${invoice.id}`,
					actor: "client",
					label: overdue ? "Overdue" : "Unpaid",
					badge: overdue ? "error" : "info",
					href: invoice.phase?.project
						? phaseHref(invoice.phase.project.publicId, invoice.phase.publicId)
						: null,
					priority: overdue ? 0 : 3,
					amount: invoice.total,
					currency: invoice.currency,
					due: overdue
						? `${formatDays(daysOverdue(invoice, now))} overdue`
						: invoice.dueAt
							? `Due ${formatDate(invoice.dueAt)}`
							: "No due date",
					overdue,
					invoice,
				};
			}),
	].toSorted((a, b) => a.priority - b.priority);
};
