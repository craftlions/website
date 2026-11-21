import type { Db } from "./database.ts";
import { and, eq, inArray, sql } from "drizzle-orm";
import { formatDays } from "./format.ts";
import { events, phases, projects } from "./schema.ts";
import {
	type BadgeType,
	daysOverdue,
	invoiceStatus,
	isInvoiceOverdue,
	type PhaseState,
	phaseStatus,
} from "./status.ts";
import { stripeInvoiceFields } from "./stripe.ts";
import { getUuidV7Date } from "./uuid.ts";

const worklistPhaseStates = [
	"submitted",
	"planned",
	"approved",
	"in_progress",
	"delivered",
] as const satisfies readonly PhaseState[];

type WorklistPhaseState = (typeof worklistPhaseStates)[number];

const phaseActor: Record<WorklistPhaseState, "admin" | "client"> = {
	submitted: "admin",
	planned: "client",
	approved: "admin",
	in_progress: "admin",
	delivered: "client",
};

const phaseStateEvents = [
	"created",
	"planned",
	"approved",
	"approved_on_behalf",
	"declined",
	"cancelled",
	"started",
	"delivered",
	"accepted",
	"accepted_on_behalf",
];

export const getLatestPhaseStateEventIds = async (
	db: Db,
	organizationId?: string,
) => {
	const rows = await db
		.select({
			phaseId: events.aggregateId,
			eventId: sql<string>`max(${events.id}::text)`,
		})
		.from(events)
		.where(
			and(
				eq(events.aggregateType, "phase"),
				inArray(
					events.aggregateId,
					db
						.select({ id: sql`${phases.id}::text` })
						.from(phases)
						.innerJoin(projects, eq(phases.projectId, projects.id))
						.where(
							and(
								inArray(phases.state, worklistPhaseStates),
								organizationId
									? eq(projects.organizationId, organizationId)
									: undefined,
							),
						),
				),
				inArray(events.event, phaseStateEvents),
			),
		)
		.groupBy(events.aggregateId);

	return new Map(rows.map((row) => [row.phaseId, row.eventId]));
};

export const getWorklistProjects = (db: Db, organizationId?: string) =>
	db.query.projects.findMany({
		columns: {
			organizationId: true,
			publicId: true,
			name: true,
			state: true,
		},
		with: {
			phases: {
				columns: {
					id: true,
					publicId: true,
					title: true,
					cost: true,
					upfrontAmount: true,
					deliveryAmount: true,
					acceptanceAmount: true,
					currency: true,
					state: true,
					version: true,
				},
				with: {
					invoices: {
						columns: {
							id: true,
							component: true,
						},
						with: {
							stripe: stripeInvoiceFields,
						},
					},
				},
				orderBy: {
					id: "asc",
				},
			},
		},
		...(organizationId ? { where: { organizationId } } : {}),
		orderBy: {
			name: "asc",
		},
	});

type WorklistProjectInput = {
	publicId: string;
	phases: ReadonlyArray<{
		id: string;
		publicId: string;
		state: PhaseState;
		invoices: ReadonlyArray<{
			id: string;
			stripe: {
				status: string;
				dueAt: Date | null;
				invoicedAt: Date | null;
			} | null;
		}>;
	}>;
};

type LiveInvoice<Invoice extends { stripe: unknown }> = Invoice & {
	stripe: NonNullable<Invoice["stripe"]>;
};

export type WorklistItem<Project extends WorklistProjectInput> = {
	key: string;
	kind: "phase" | "invoice";
	status: WorklistPhaseState | "overdue" | "open";
	label: string;
	badge: BadgeType;
	actor: "admin" | "client";
	ageDays: number;
	age: string;
	href: string;
	priority: number;
	project: Project;
	phase: Project["phases"][number];
	invoice: LiveInvoice<Project["phases"][number]["invoices"][number]> | null;
};

const daysBetween = (from: Date | null, now: Date) =>
	from
		? Math.max(0, Math.floor((now.getTime() - from.getTime()) / 86_400_000))
		: 0;

export const compareWorklistItems = (
	a: { priority: number; ageDays: number },
	b: { priority: number; ageDays: number },
) => a.priority - b.priority || b.ageDays - a.ageDays;

export const deriveWorklist = <Project extends WorklistProjectInput>(input: {
	organizationId: string;
	projects: ReadonlyArray<Project>;
	latestStateEventIds?: ReadonlyMap<string, string>;
	now?: Date;
}): WorklistItem<Project>[] => {
	const now = input.now ?? new Date();
	const invoicesHref = `/admin/org/${input.organizationId}/invoices`;

	return input.projects
		.flatMap((project) =>
			project.phases.flatMap((phase): WorklistItem<Project>[] => {
				const liveInvoices = phase.invoices.filter(
					(invoice): invoice is LiveInvoice<typeof invoice> =>
						invoice.stripe !== null,
				);
				const invoiceItem = (
					invoice: (typeof liveInvoices)[number],
				): WorklistItem<Project> => {
					const overdue = isInvoiceOverdue(invoice.stripe, now);
					const ageDays = overdue
						? daysOverdue(invoice.stripe, now)
						: daysBetween(
								invoice.stripe.invoicedAt ?? getUuidV7Date(invoice.id),
								now,
							);
					const status = invoiceStatus(invoice.stripe, now);
					return {
						key: `invoice-${invoice.id}`,
						kind: "invoice",
						status: overdue ? "overdue" : "open",
						label: status.label,
						badge: status.badge,
						actor: "client",
						ageDays,
						age: overdue
							? `${formatDays(ageDays)} overdue`
							: formatDays(ageDays),
						href: invoicesHref,
						priority: overdue ? 0 : worklistPhaseStates.length + 1,
						project,
						phase,
						invoice,
					};
				};

				const stateIndex = (
					worklistPhaseStates as readonly PhaseState[]
				).indexOf(phase.state);
				const state = worklistPhaseStates[stateIndex];
				if (state) {
					const ageDays = daysBetween(
						getUuidV7Date(input.latestStateEventIds?.get(phase.id) ?? phase.id),
						now,
					);
					return [
						...liveInvoices
							.filter((invoice) => isInvoiceOverdue(invoice.stripe, now))
							.map(invoiceItem),
						{
							key: `phase-${phase.id}`,
							kind: "phase",
							status: state,
							label: phaseStatus[state].label,
							badge: phaseStatus[state].badge,
							actor: phaseActor[state],
							ageDays,
							age: formatDays(ageDays),
							href: `/admin/org/${input.organizationId}/projects/${project.publicId}#phase-${phase.publicId}`,
							priority: stateIndex + 1,
							project,
							phase,
							invoice: null,
						},
					];
				}

				return liveInvoices
					.filter((invoice) => invoice.stripe.status === "open")
					.map(invoiceItem);
			}),
		)
		.toSorted(compareWorklistItems);
};
