import type { Auth } from "./auth.ts";
import type { Db } from "./database.ts";
import { getOrgAdapter } from "better-auth/plugins/organization";
import { and, eq, isNull, sql } from "drizzle-orm";
import { resolveDelivery } from "./delivery.ts";
import { assertAdminUser, DomainError } from "./domain.ts";
import {
	events,
	invoices,
	organizationMetadata,
	phases,
	projects,
} from "./schema.ts";
import { fetchStripeInvoice, stripeInvoiceSnapshot } from "./stripe.ts";

export const toSlug = (value: string) =>
	value
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "");

const publicId = () => crypto.randomUUID();

type PhaseAmountInput = {
	upfrontAmount?: number | null | undefined;
	deliveryAmount?: number | null | undefined;
	acceptanceAmount?: number | null | undefined;
};

const phaseAmountUnits = (amount: number) => {
	if (!Number.isFinite(amount) || amount < 0) {
		throw new DomainError(
			"Validation",
			"Phase amounts must be non-negative numbers.",
		);
	}

	return Math.round(amount * 10_000);
};

const resolvePhaseAmounts = (
	cost: number,
	input: PhaseAmountInput,
	defaultToAcceptance = false,
) => {
	const costUnits = phaseAmountUnits(cost);
	const hasAmountInput =
		input.upfrontAmount !== undefined ||
		input.deliveryAmount !== undefined ||
		input.acceptanceAmount !== undefined;

	// Keep callers of the existing API compatible: omitted component amounts
	// retain the legacy all-at-acceptance billing shape.
	if (!hasAmountInput && defaultToAcceptance) {
		return {
			upfrontAmount: null,
			deliveryAmount: null,
			acceptanceAmount: costUnits / 10_000,
		};
	}

	const amounts = {
		upfrontAmount: input.upfrontAmount ?? null,
		deliveryAmount: input.deliveryAmount ?? null,
		acceptanceAmount: input.acceptanceAmount ?? null,
	};
	const presentAmounts = Object.values(amounts).filter(
		(amount): amount is number => amount !== null,
	);

	if (presentAmounts.length === 0) {
		throw new DomainError(
			"Validation",
			"At least one phase cost component is required.",
		);
	}

	const amountUnits = presentAmounts.reduce(
		(total, amount) => total + phaseAmountUnits(amount),
		0,
	);

	if (amountUnits !== costUnits) {
		throw new DomainError(
			"Validation",
			"Phase cost components must sum to the phase cost.",
		);
	}

	return {
		upfrontAmount:
			amounts.upfrontAmount === null
				? null
				: phaseAmountUnits(amounts.upfrontAmount) / 10_000,
		deliveryAmount:
			amounts.deliveryAmount === null
				? null
				: phaseAmountUnits(amounts.deliveryAmount) / 10_000,
		acceptanceAmount:
			amounts.acceptanceAmount === null
				? null
				: phaseAmountUnits(amounts.acceptanceAmount) / 10_000,
	};
};

const getOrganizationAdapter = async (auth: Auth) => {
	type OrganizationAuthContext = Parameters<typeof getOrgAdapter>[0] & {
		orgOptions?: Parameters<typeof getOrgAdapter>[1];
	};
	const context = (await auth.$context) as unknown as OrganizationAuthContext;
	return getOrgAdapter(context, context.orgOptions);
};

const insertEvent = async (
	tx: Parameters<Parameters<Db["transaction"]>[0]>[0],
	input: {
		aggregateType: "invoice" | "organization" | "phase" | "project";
		aggregateId: string;
		aggregateVersion?: number;
		event: string;
		actorId: string;
	},
) => {
	const values = {
		publicId: publicId(),
		aggregateType: input.aggregateType,
		aggregateId: input.aggregateId,
		aggregateVersion: input.aggregateVersion,
		event: input.event,
		actorType: "user" as const,
		actorId: input.actorId,
	};

	if (input.aggregateVersion === undefined) {
		await tx.insert(events).values(values);
		return;
	}

	const rows = await tx
		.insert(events)
		.values(values)
		.onConflictDoNothing()
		.returning({ id: events.id });

	if (!rows[0]) {
		throw new DomainError(
			"Conflict",
			"A transition event already exists for this version.",
		);
	}
};

const getAuthorizedClientPhaseId = async (
	db: Db,
	actorId: string,
	phasePublicId: string,
	forbiddenMessage: string,
) => {
	const phase = await db.query.phases.findFirst({
		columns: { id: true },
		with: {
			project: { columns: { organizationId: true } },
		},
		where: { publicId: phasePublicId },
	});

	if (!phase?.project) {
		throw new DomainError("NotFound", "Phase not found.");
	}

	const membership = await db.query.member.findFirst({
		columns: { role: true },
		where: {
			userId: actorId,
			organizationId: phase.project.organizationId,
		},
	});

	if (!membership || !["owner", "admin"].includes(membership.role)) {
		throw new DomainError("Forbidden", forbiddenMessage);
	}

	return phase.id;
};

export const approvePhaseAsClient = async (
	db: Db,
	actorId: string,
	input: {
		phasePublicId: string;
		event: "approved" | "declined";
		expectedVersion: number;
	},
) => {
	const phaseId = await getAuthorizedClientPhaseId(
		db,
		actorId,
		input.phasePublicId,
		"Only organization owners can approve or decline phases.",
	);

	return transitionPhase(
		db,
		actorId,
		phaseId,
		input.expectedVersion,
		input.event === "approved" ? "approved" : "cancelled",
		["planned"],
		input.event,
		"Only planned phases can be approved or declined.",
	);
};

export const acceptPhaseAsClient = async (
	db: Db,
	actorId: string,
	input: {
		phasePublicId: string;
		expectedVersion: number;
	},
) => {
	const phaseId = await getAuthorizedClientPhaseId(
		db,
		actorId,
		input.phasePublicId,
		"Only organization owners or admins can accept phases.",
	);

	return transitionPhase(
		db,
		actorId,
		phaseId,
		input.expectedVersion,
		"accepted",
		["delivered"],
		"accepted",
		"Only delivered phases can be accepted.",
	);
};

export const createProject = async (
	db: Db,
	actorId: string,
	input: { organizationId: string; name: string },
) => {
	await assertAdminUser(db, actorId);

	const selectedOrganization = await db.query.organization.findFirst({
		columns: { id: true },
		where: { id: input.organizationId },
	});

	if (!selectedOrganization) {
		throw new DomainError("NotFound", "Organization not found.");
	}

	return db.transaction(async (tx) => {
		const rows = await tx
			.insert(projects)
			.values({
				publicId: publicId(),
				organizationId: input.organizationId,
				name: input.name.trim(),
				state: "draft",
			})
			.returning({
				id: projects.id,
				publicId: projects.publicId,
				version: projects.version,
			});

		if (!rows[0]) {
			throw new DomainError("Validation", "Project could not be created.");
		}

		await insertEvent(tx, {
			aggregateType: "project",
			aggregateId: rows[0].id,
			aggregateVersion: rows[0].version,
			event: "created",
			actorId,
		});

		return rows[0];
	});
};

const nextProjectEvents = {
	active: "activated",
	completed: "completed",
	archived: "archived",
} as const;

export const transitionProject = async (
	db: Db,
	actorId: string,
	input: {
		projectId: string;
		nextState: "active" | "completed" | "archived";
		expectedVersion: number;
	},
) => {
	await assertAdminUser(db, actorId);

	return db.transaction(async (tx) => {
		const [project] = await tx
			.select({
				id: projects.id,
				state: projects.state,
				version: projects.version,
			})
			.from(projects)
			.where(eq(projects.id, input.projectId))
			.for("update");

		if (!project) {
			throw new DomainError("NotFound", "Project not found.");
		}

		if (
			project.state === input.nextState &&
			project.version === input.expectedVersion + 1
		) {
			return { idempotent: true };
		}

		if (project.version !== input.expectedVersion) {
			throw new DomainError(
				"Conflict",
				"This project was changed by another request. Refresh and try again.",
			);
		}

		const valid =
			(project.state === "draft" && input.nextState === "active") ||
			(project.state === "active" && input.nextState === "completed") ||
			(project.state === "completed" && input.nextState === "active") ||
			(project.state === "completed" && input.nextState === "archived");

		if (!valid) {
			throw new DomainError("InvalidTransition", "Invalid project transition.");
		}

		if (project.state === "active" && input.nextState === "completed") {
			const projectPhases = await tx.query.phases.findMany({
				columns: { state: true },
				where: { projectId: project.id },
			});

			if (
				projectPhases.some(
					(phase) => !["accepted", "cancelled"].includes(phase.state),
				)
			) {
				throw new DomainError(
					"InvalidTransition",
					"All phases must be accepted or cancelled before completing a project.",
				);
			}
		}

		const rows = await tx
			.update(projects)
			.set({ state: input.nextState, version: sql`${projects.version} + 1` })
			.where(
				and(
					eq(projects.id, project.id),
					eq(projects.state, project.state),
					eq(projects.version, input.expectedVersion),
				),
			)
			.returning({ id: projects.id });

		if (!rows[0]) {
			throw new DomainError(
				"Conflict",
				"This project was changed by another request. Refresh and try again.",
			);
		}

		await insertEvent(tx, {
			aggregateType: "project",
			aggregateId: project.id,
			aggregateVersion: input.expectedVersion + 1,
			event:
				project.state === "completed" && input.nextState === "active"
					? "reopened"
					: nextProjectEvents[input.nextState],
			actorId,
		});

		return { idempotent: false };
	});
};

export const createPhase = async (
	db: Db,
	actorId: string,
	input: {
		projectId: string;
		title: string;
		cost: number;
		upfrontAmount?: number | null | undefined;
		deliveryAmount?: number | null | undefined;
		acceptanceAmount?: number | null | undefined;
		currency: string;
		dueAt?: Date | null | undefined;
	},
) => {
	await assertAdminUser(db, actorId);
	const amounts = resolvePhaseAmounts(input.cost, input, true);

	return db.transaction(async (tx) => {
		const [project] = await tx
			.select({ id: projects.id, state: projects.state })
			.from(projects)
			.where(eq(projects.id, input.projectId))
			.for("update");

		if (!project) {
			throw new DomainError("NotFound", "Project not found.");
		}

		if (!["draft", "active"].includes(project.state)) {
			throw new DomainError(
				"InvalidTransition",
				"Phases can only be created on draft or active projects.",
			);
		}

		const rows = await tx
			.insert(phases)
			.values({
				publicId: publicId(),
				projectId: project.id,
				title: input.title.trim(),
				cost: input.cost,
				...amounts,
				currency: input.currency.toUpperCase(),
				state: "submitted",
				dueAt: input.dueAt ?? null,
			})
			.returning({
				id: phases.id,
				publicId: phases.publicId,
				version: phases.version,
			});

		if (!rows[0]) {
			throw new DomainError("Validation", "Phase could not be created.");
		}

		await insertEvent(tx, {
			aggregateType: "phase",
			aggregateId: rows[0].id,
			aggregateVersion: rows[0].version,
			event: "created",
			actorId,
		});

		return rows[0];
	});
};

export const updatePhaseAmounts = async (
	db: Db,
	actorId: string,
	input: PhaseAmountInput & {
		phaseId: string;
		expectedVersion: number;
	},
) => {
	await assertAdminUser(db, actorId);

	return db.transaction(async (tx) => {
		const [phase] = await tx
			.select({
				id: phases.id,
				state: phases.state,
				version: phases.version,
				cost: phases.cost,
			})
			.from(phases)
			.where(eq(phases.id, input.phaseId))
			.for("update");

		if (!phase) {
			throw new DomainError("NotFound", "Phase not found.");
		}

		if (phase.version !== input.expectedVersion) {
			throw new DomainError(
				"Conflict",
				"This phase was changed by another request. Refresh and try again.",
			);
		}

		if (
			["approved", "in_progress", "delivered", "accepted"].includes(phase.state)
		) {
			throw new DomainError(
				"InvalidTransition",
				"Phase cost components are locked after approval.",
			);
		}

		// The row lock makes the approval transition and this edit serialize;
		// once approval wins, this guard rejects the amount change.
		const amounts = resolvePhaseAmounts(phase.cost, input);
		const rows = await tx
			.update(phases)
			.set({ ...amounts, version: sql`${phases.version} + 1` })
			.where(
				and(eq(phases.id, phase.id), eq(phases.version, input.expectedVersion)),
			)
			.returning({ id: phases.id });

		if (!rows[0]) {
			throw new DomainError(
				"Conflict",
				"This phase was changed by another request. Refresh and try again.",
			);
		}

		await insertEvent(tx, {
			aggregateType: "phase",
			aggregateId: phase.id,
			aggregateVersion: input.expectedVersion + 1,
			event: "amounts_updated",
			actorId,
		});

		return { idempotent: false };
	});
};

const phaseTransitions = {
	planned: { from: "submitted", event: "planned" },
	approved: { from: "planned", event: "approved_on_behalf" },
	in_progress: { from: "approved", event: "started" },
	// Acceptance is explicit: only a delivered phase can be accepted.
	accepted: { from: "delivered", event: "accepted_on_behalf" },
	cancelled: { from: ["submitted", "planned"], event: "cancelled" },
} as const;

const transitionPhase = async (
	db: Db,
	actorId: string,
	phaseId: string,
	expectedVersion: number,
	nextState: "planned" | "approved" | "in_progress" | "accepted" | "cancelled",
	from: readonly string[],
	event: string,
	invalidTransitionMessage: string,
) =>
	db.transaction(async (tx) => {
		const [phase] = await tx
			.select({
				id: phases.id,
				state: phases.state,
				version: phases.version,
			})
			.from(phases)
			.where(eq(phases.id, phaseId))
			.for("update");

		if (!phase) {
			throw new DomainError("NotFound", "Phase not found.");
		}

		if (phase.state === nextState && phase.version === expectedVersion + 1) {
			return { idempotent: true };
		}

		if (phase.version !== expectedVersion) {
			throw new DomainError(
				"Conflict",
				"This phase was changed by another request. Refresh and try again.",
			);
		}

		if (!from.includes(phase.state)) {
			throw new DomainError("InvalidTransition", invalidTransitionMessage);
		}

		const rows = await tx
			.update(phases)
			.set({ state: nextState, version: sql`${phases.version} + 1` })
			.where(
				and(
					eq(phases.id, phase.id),
					eq(phases.state, phase.state),
					eq(phases.version, expectedVersion),
				),
			)
			.returning({ id: phases.id });

		if (!rows[0]) {
			throw new DomainError(
				"Conflict",
				"This phase was changed by another request. Refresh and try again.",
			);
		}

		await insertEvent(tx, {
			aggregateType: "phase",
			aggregateId: phase.id,
			aggregateVersion: expectedVersion + 1,
			event,
			actorId,
		});

		return { idempotent: false };
	});

export const transitionPhaseAsAdmin = async (
	db: Db,
	actorId: string,
	input: {
		phaseId: string;
		nextState:
			| "planned"
			| "approved"
			| "in_progress"
			| "accepted"
			| "cancelled";
		expectedVersion: number;
	},
) => {
	await assertAdminUser(db, actorId);

	const transition = phaseTransitions[input.nextState];
	const from: readonly string[] =
		typeof transition.from === "string" ? [transition.from] : transition.from;

	return transitionPhase(
		db,
		actorId,
		input.phaseId,
		input.expectedVersion,
		input.nextState,
		from,
		transition.event,
		"Invalid phase transition.",
	);
};

/**
 * Delivery recording is its own mutation (S-005 R7): it requires no invoice
 * and transitions `in_progress → delivered`. The `deliveryState`/
 * `deliveryUrl` columns stay the delivery record, consistent with the schema
 * CHECK constraint; a same-delivery retry after success is idempotent.
 */
export const recordDelivery = async (
	db: Db,
	actorId: string,
	input: {
		phaseId: string;
		expectedVersion: number;
		deliveryChoice?: "url" | "none" | undefined;
		deliveryUrl?: string | null | undefined;
	},
) => {
	await assertAdminUser(db, actorId);

	const delivery = resolveDelivery(input.deliveryChoice, input.deliveryUrl);

	return db.transaction(async (tx) => {
		const [phase] = await tx
			.select({
				id: phases.id,
				state: phases.state,
				version: phases.version,
				deliveryState: phases.deliveryState,
				deliveryUrl: phases.deliveryUrl,
			})
			.from(phases)
			.where(eq(phases.id, input.phaseId))
			.for("update");

		if (!phase) {
			throw new DomainError("NotFound", "Phase not found.");
		}

		// Delivery already recorded with the same choice: idempotent retry.
		if (
			phase.state === "delivered" &&
			phase.version === input.expectedVersion + 1 &&
			phase.deliveryState === delivery.deliveryState &&
			phase.deliveryUrl === delivery.deliveryUrl
		) {
			return { idempotent: true };
		}

		if (phase.version !== input.expectedVersion) {
			throw new DomainError(
				"Conflict",
				"This phase was changed by another request. Refresh and try again.",
			);
		}

		if (phase.state !== "in_progress") {
			throw new DomainError(
				"InvalidTransition",
				"Delivery can only be recorded on in-progress phases.",
			);
		}

		const rows = await tx
			.update(phases)
			.set({
				state: "delivered",
				version: sql`${phases.version} + 1`,
				deliveryState: delivery.deliveryState,
				deliveryUrl: delivery.deliveryUrl,
			})
			.where(
				and(
					eq(phases.id, phase.id),
					eq(phases.state, "in_progress"),
					eq(phases.version, input.expectedVersion),
				),
			)
			.returning({ id: phases.id });

		if (!rows[0]) {
			throw new DomainError(
				"Conflict",
				"This phase was changed by another request. Refresh and try again.",
			);
		}

		await insertEvent(tx, {
			aggregateType: "phase",
			aggregateId: phase.id,
			aggregateVersion: input.expectedVersion + 1,
			event: "delivered",
			actorId,
		});

		return { idempotent: false };
	});
};

export const recordInvoice = async (
	db: Db,
	actorId: string,
	input: {
		phaseId: string;
		invoiceNumber: string;
		stripeId: string;
		stripePaymentPage: string;
		total: number;
		expectedVersion: number;
		stripeKey: string;
	},
) => {
	await assertAdminUser(db, actorId);

	const phase = await db.query.phases.findFirst({
		columns: {
			id: true,
			state: true,
			currency: true,
			version: true,
		},
		where: { id: input.phaseId },
	});

	if (!phase) {
		throw new DomainError("NotFound", "Phase not found.");
	}

	const invoice = await db.query.invoices.findFirst({
		columns: {
			id: true,
			publicId: true,
			phaseId: true,
			invoiceNumber: true,
			stripeId: true,
			stripePaymentPage: true,
			currency: true,
			total: true,
		},
		where: { phaseId: phase.id },
	});

	const invoiceMatches = (
		phaseRow: { id: string; currency: string },
		invoiceRow: typeof invoice,
	): invoiceRow is NonNullable<typeof invoice> =>
		invoiceRow?.phaseId === phaseRow.id &&
		invoiceRow.invoiceNumber === input.invoiceNumber.trim() &&
		invoiceRow.stripeId === input.stripeId.trim() &&
		invoiceRow.stripePaymentPage === input.stripePaymentPage.trim() &&
		invoiceRow.currency === phaseRow.currency &&
		invoiceRow.total === input.total;

	// Invoice recording no longer moves the lifecycle (S-005 R5/R7): the phase
	// stays in its work state and only the invoice row is written. A retry that
	// already recorded the same invoice is idempotent.
	if (invoice && invoiceMatches(phase, invoice)) {
		return {
			invoice: { id: invoice.id, publicId: invoice.publicId },
			created: false,
		};
	}

	if (phase.version !== input.expectedVersion) {
		throw new DomainError(
			"Conflict",
			"This phase was changed by another request. Refresh and try again.",
		);
	}

	if (
		!["approved", "in_progress", "delivered", "accepted"].includes(phase.state)
	) {
		throw new DomainError(
			"InvalidTransition",
			"Invoices can only be recorded on phases from approval onward.",
		);
	}

	if (invoice) {
		throw new DomainError(
			"AlreadyExists",
			"This phase already has an invoice.",
		);
	}

	const stripeInvoice = await fetchStripeInvoice({
		stripeId: input.stripeId.trim(),
		stripeKey: input.stripeKey,
	});

	return db.transaction(async (tx) => {
		const [lockedPhase] = await tx
			.select({
				id: phases.id,
				projectId: phases.projectId,
				state: phases.state,
				currency: phases.currency,
				version: phases.version,
			})
			.from(phases)
			.where(eq(phases.id, input.phaseId))
			.for("update");

		if (!lockedPhase) {
			throw new DomainError("NotFound", "Phase not found.");
		}

		const lockedInvoice = await tx.query.invoices.findFirst({
			columns: {
				id: true,
				publicId: true,
				phaseId: true,
				invoiceNumber: true,
				stripeId: true,
				stripePaymentPage: true,
				currency: true,
				total: true,
			},
			where: { phaseId: lockedPhase.id },
		});

		if (lockedInvoice && invoiceMatches(lockedPhase, lockedInvoice)) {
			return {
				invoice: {
					id: lockedInvoice.id,
					publicId: lockedInvoice.publicId,
				},
				created: false,
			};
		}

		if (lockedPhase.version !== input.expectedVersion) {
			throw new DomainError(
				"Conflict",
				"This phase was changed by another request. Refresh and try again.",
			);
		}

		if (
			!["approved", "in_progress", "delivered", "accepted"].includes(
				lockedPhase.state,
			)
		) {
			throw new DomainError(
				"InvalidTransition",
				"Invoices can only be recorded on phases from approval onward.",
			);
		}

		if (lockedInvoice) {
			throw new DomainError(
				"AlreadyExists",
				"This phase already has an invoice.",
			);
		}

		const project = await tx.query.projects.findFirst({
			columns: { organizationId: true },
			where: { id: lockedPhase.projectId },
		});

		if (!project) {
			throw new DomainError("NotFound", "Project not found.");
		}

		const rows = await tx
			.insert(invoices)
			.values({
				publicId: publicId(),
				organizationId: project.organizationId,
				phaseId: lockedPhase.id,
				invoiceNumber: input.invoiceNumber.trim(),
				stripeId: input.stripeId.trim(),
				stripePaymentPage: input.stripePaymentPage.trim(),
				currency: lockedPhase.currency,
				total: input.total,
				invoicedAt: stripeInvoiceSnapshot(stripeInvoice).invoicedAt,
			})
			.onConflictDoNothing()
			.returning({ id: invoices.id, publicId: invoices.publicId });

		if (!rows[0]) {
			throw new DomainError(
				"Conflict",
				"This invoice was recorded by another request. Refresh and try again.",
			);
		}

		return { invoice: rows[0], created: true };
	});
};

export const attachInvoiceToPhase = async (
	db: Db,
	actorId: string,
	input: {
		invoiceId: string;
		phaseId: string;
		expectedVersion: number;
	},
) => {
	await assertAdminUser(db, actorId);

	return db.transaction(async (tx) => {
		const [phase] = await tx
			.select({
				id: phases.id,
				projectId: phases.projectId,
				state: phases.state,
				currency: phases.currency,
				version: phases.version,
			})
			.from(phases)
			.where(eq(phases.id, input.phaseId))
			.for("update");

		if (!phase) {
			throw new DomainError("NotFound", "Phase not found.");
		}

		const [invoice] = await tx
			.select({
				id: invoices.id,
				organizationId: invoices.organizationId,
				phaseId: invoices.phaseId,
				currency: invoices.currency,
			})
			.from(invoices)
			.where(eq(invoices.id, input.invoiceId))
			.for("update");

		if (!invoice) {
			throw new DomainError("NotFound", "Invoice not found.");
		}

		// Already attached to this phase: idempotent retry. Attachment no longer
		// moves the lifecycle (S-005 R5/R7), so no Delivery or state is written.
		if (invoice.phaseId === phase.id) {
			return { idempotent: true };
		}

		if (phase.version !== input.expectedVersion) {
			throw new DomainError(
				"Conflict",
				"This phase was changed by another request. Refresh and try again.",
			);
		}

		if (invoice.phaseId) {
			throw new DomainError(
				"Conflict",
				"This invoice is already attached to a phase.",
			);
		}

		const existingPhaseInvoice = await tx.query.invoices.findFirst({
			columns: { id: true },
			where: { phaseId: phase.id },
		});

		if (existingPhaseInvoice) {
			throw new DomainError("Conflict", "This phase already has an invoice.");
		}

		const project = await tx.query.projects.findFirst({
			columns: { organizationId: true },
			where: { id: phase.projectId },
		});

		if (!project) {
			throw new DomainError("NotFound", "Project not found.");
		}

		if (project.organizationId !== invoice.organizationId) {
			throw new DomainError(
				"Validation",
				"Phase belongs to a different organization.",
			);
		}

		if (
			!["approved", "in_progress", "delivered", "accepted"].includes(
				phase.state,
			)
		) {
			throw new DomainError(
				"InvalidTransition",
				"Invoices can only be attached to phases from approval onward.",
			);
		}

		if (phase.currency !== invoice.currency) {
			throw new DomainError(
				"Validation",
				"Invoice currency does not match the phase currency.",
			);
		}

		const attached = await tx
			.update(invoices)
			.set({ phaseId: phase.id })
			.where(and(eq(invoices.id, invoice.id), isNull(invoices.phaseId)))
			.returning({ id: invoices.id });

		if (!attached[0]) {
			throw new DomainError(
				"Conflict",
				"This invoice was attached by another request. Refresh and try again.",
			);
		}

		return { idempotent: false };
	});
};

export const updatePhaseDelivery = async (
	db: Db,
	actorId: string,
	input: {
		phaseId: string;
		expectedVersion: number;
		deliveryChoice?: "url" | "none" | undefined;
		deliveryUrl?: string | null | undefined;
	},
) => {
	await assertAdminUser(db, actorId);

	const delivery = resolveDelivery(input.deliveryChoice, input.deliveryUrl);

	return db.transaction(async (tx) => {
		const [phase] = await tx
			.select({
				id: phases.id,
				state: phases.state,
				version: phases.version,
				deliveryState: phases.deliveryState,
				deliveryUrl: phases.deliveryUrl,
			})
			.from(phases)
			.where(eq(phases.id, input.phaseId))
			.for("update");

		if (!phase) {
			throw new DomainError("NotFound", "Phase not found.");
		}

		// Delivery correction (S-003 AC7) only applies once delivery is recorded;
		// recording is its own mutation (`recordDelivery`), and this correction
		// never changes the lifecycle state. Legacy `accepted` rows carry a
		// delivery record from the old invoice-coupled capture and stay correctable.
		if (phase.state !== "delivered" && phase.state !== "accepted") {
			throw new DomainError(
				"InvalidTransition",
				"Delivery can only be updated for delivered or accepted phases.",
			);
		}

		// Same Delivery already stored: nothing to change, stay idempotent on retry.
		if (
			phase.deliveryState === delivery.deliveryState &&
			phase.deliveryUrl === delivery.deliveryUrl
		) {
			return { idempotent: true };
		}

		if (phase.version !== input.expectedVersion) {
			throw new DomainError(
				"Conflict",
				"This phase was changed by another request. Refresh and try again.",
			);
		}

		const updated = await tx
			.update(phases)
			.set({
				version: sql`${phases.version} + 1`,
				deliveryState: delivery.deliveryState,
				deliveryUrl: delivery.deliveryUrl,
			})
			.where(
				and(eq(phases.id, phase.id), eq(phases.version, input.expectedVersion)),
			)
			.returning({ id: phases.id });

		if (!updated[0]) {
			throw new DomainError(
				"Conflict",
				"This phase was changed by another request. Refresh and try again.",
			);
		}

		await insertEvent(tx, {
			aggregateType: "phase",
			aggregateId: phase.id,
			aggregateVersion: input.expectedVersion + 1,
			event: "delivery_updated",
			actorId,
		});

		return { idempotent: false };
	});
};

const writeOrganizationOnboardingRemainder = async (
	db: Db,
	actorId: string,
	input: { organizationId: string; yearlyBudget?: number | null | undefined },
) => {
	await db.transaction(async (tx) => {
		await tx
			.insert(organizationMetadata)
			.values({
				organizationId: input.organizationId,
				yearlyBudget: input.yearlyBudget ?? null,
			})
			.onConflictDoUpdate({
				target: organizationMetadata.organizationId,
				set: { yearlyBudget: input.yearlyBudget ?? null },
			});

		const existingCreatedEvent = await tx
			.select({ id: events.id })
			.from(events)
			.where(
				and(
					eq(events.aggregateType, "organization"),
					eq(events.aggregateId, input.organizationId),
					eq(events.event, "created"),
				),
			)
			.limit(1);

		if (!existingCreatedEvent[0]) {
			await insertEvent(tx, {
				aggregateType: "organization",
				aggregateId: input.organizationId,
				event: "created",
				actorId,
			});
		}
	});
};

export const onboardOrganization = async (
	db: Db,
	auth: Auth,
	actorId: string,
	input: {
		email: string;
		name: string;
		organizationName: string;
		slug: string;
		yearlyBudget?: number | null | undefined;
	},
) => {
	await assertAdminUser(db, actorId);

	const email = input.email.trim().toLowerCase();
	const slug = toSlug(input.slug);
	let selectedUser = await db.query.user.findFirst({
		columns: { id: true },
		where: { email },
	});
	let createdUser = false;
	const existingOrganization = await db.query.organization.findFirst({
		columns: { id: true },
		where: { slug },
	});

	if (existingOrganization) {
		if (!selectedUser) {
			throw new DomainError(
				"AlreadyExists",
				"That organization slug is taken.",
			);
		}

		const existingMember = await db.query.member.findFirst({
			columns: { id: true },
			where: {
				organizationId: existingOrganization.id,
				userId: selectedUser.id,
			},
		});

		if (!existingMember) {
			throw new DomainError(
				"AlreadyExists",
				"That organization slug is taken.",
			);
		}

		await writeOrganizationOnboardingRemainder(db, actorId, {
			organizationId: existingOrganization.id,
			yearlyBudget: input.yearlyBudget,
		});

		return existingOrganization;
	}

	if (!selectedUser) {
		const result = await auth.api.createUser({
			body: {
				email,
				name: input.name.trim(),
				password: crypto.randomUUID(),
			},
		});
		selectedUser = { id: result.user.id };
		createdUser = true;
	}

	const createdOrganization = await auth.api.createOrganization({
		body: {
			name: input.organizationName.trim(),
			slug,
			userId: selectedUser.id,
		},
	});

	await writeOrganizationOnboardingRemainder(db, actorId, {
		organizationId: createdOrganization.id,
		yearlyBudget: input.yearlyBudget,
	});

	if (createdUser) {
		await auth.api.requestPasswordReset({
			body: { email, redirectTo: "/reset-password" },
		});
	}

	return createdOrganization;
};

export const addOrganizationMember = async (
	db: Db,
	auth: Auth,
	actorId: string,
	input: {
		organizationId: string;
		email: string;
		name: string;
		role: "owner" | "member";
	},
) => {
	await assertAdminUser(db, actorId);

	const email = input.email.trim().toLowerCase();
	let selectedUser = await db.query.user.findFirst({
		columns: { id: true },
		where: { email },
	});
	let createdUser = false;

	if (!selectedUser) {
		const result = await auth.api.createUser({
			body: {
				email,
				name: input.name.trim(),
				password: crypto.randomUUID(),
			},
		});
		selectedUser = { id: result.user.id };
		createdUser = true;
	}

	const existingMember = await db.query.member.findFirst({
		columns: { id: true },
		where: { organizationId: input.organizationId, userId: selectedUser.id },
	});

	if (!existingMember) {
		await auth.api.addMember({
			body: {
				organizationId: input.organizationId,
				userId: selectedUser.id,
				role: input.role,
			},
		});
	}

	await db.transaction(async (tx) => {
		await insertEvent(tx, {
			aggregateType: "organization",
			aggregateId: input.organizationId,
			event: existingMember ? "member_unchanged" : "member_added",
			actorId,
		});
	});

	if (createdUser) {
		await auth.api.requestPasswordReset({
			body: { email, redirectTo: "/reset-password" },
		});
	}
};

export const removeOrganizationMember = async (
	db: Db,
	auth: Auth,
	actorId: string,
	input: { organizationId: string; memberId: string },
) => {
	await assertAdminUser(db, actorId);

	const selectedMember = await db.query.member.findFirst({
		columns: { id: true },
		where: {
			id: input.memberId,
			organizationId: input.organizationId,
		},
	});

	if (!selectedMember) {
		throw new DomainError("NotFound", "Member not found.");
	}

	await (await getOrganizationAdapter(auth)).deleteMember({
		memberId: input.memberId,
		organizationId: input.organizationId,
	});

	await db.transaction(async (tx) => {
		await insertEvent(tx, {
			aggregateType: "organization",
			aggregateId: input.organizationId,
			event: "member_removed",
			actorId,
		});
	});
};

export const removeNeverLoggedInUser = async (
	db: Db,
	auth: Auth,
	actorId: string,
	input: { userId: string },
) => {
	await assertAdminUser(db, actorId);

	const selectedUser = await db.query.user.findFirst({
		columns: { id: true, lastActiveAt: true },
		where: { id: input.userId },
	});

	if (!selectedUser) {
		throw new DomainError("NotFound", "User not found.");
	}

	if (selectedUser.lastActiveAt) {
		throw new DomainError(
			"InvalidTransition",
			"Only never-logged-in users can be removed.",
		);
	}

	const memberships = await db.query.member.findMany({
		columns: { organizationId: true },
		where: { userId: input.userId },
	});
	const context = await auth.$context;
	await context.internalAdapter.deleteUserSessions(input.userId);
	await context.internalAdapter.deleteUser(input.userId);

	await db.transaction(async (tx) => {
		for (const membership of memberships) {
			await insertEvent(tx, {
				aggregateType: "organization",
				aggregateId: membership.organizationId,
				event: "user_removed",
				actorId,
			});
		}
	});
};

export const updateOrganizationSettings = async (
	db: Db,
	auth: Auth,
	actorId: string,
	input: {
		organizationId: string;
		name: string;
		slug: string;
		logo?: string | null | undefined;
		yearlyBudget?: number | null | undefined;
		stripeCustomerId?: string | null | undefined;
	},
) => {
	await assertAdminUser(db, actorId);

	const slug = toSlug(input.slug);
	const adapter = await getOrganizationAdapter(auth);
	const slugCollision = await adapter.findOrganizationBySlug(slug);

	if (slugCollision && slugCollision.id !== input.organizationId) {
		throw new DomainError("AlreadyExists", "That organization slug is taken.");
	}

	const updatedOrganization = await adapter.updateOrganization(
		input.organizationId,
		{
			name: input.name.trim(),
			slug,
			logo: input.logo?.trim() || null,
		},
	);

	if (!updatedOrganization) {
		throw new DomainError("NotFound", "Organization not found.");
	}

	await db.transaction(async (tx) => {
		await tx
			.insert(organizationMetadata)
			.values({
				organizationId: input.organizationId,
				yearlyBudget: input.yearlyBudget ?? null,
				stripeCustomerId: input.stripeCustomerId?.trim() || null,
			})
			.onConflictDoUpdate({
				target: organizationMetadata.organizationId,
				set: {
					yearlyBudget: input.yearlyBudget ?? null,
					stripeCustomerId: input.stripeCustomerId?.trim() || null,
				},
			});
		await insertEvent(tx, {
			aggregateType: "organization",
			aggregateId: input.organizationId,
			event: "updated",
			actorId,
		});
	});
};

export const hardDeleteOrganization = async (
	db: Db,
	auth: Auth,
	actorId: string,
	input: { organizationId: string; confirmation: string },
) => {
	await assertAdminUser(db, actorId);

	const selectedOrganization = await db.query.organization.findFirst({
		columns: { id: true, name: true },
		with: { projects: { columns: { id: true } } },
		where: { id: input.organizationId },
	});

	if (!selectedOrganization) {
		throw new DomainError("NotFound", "Organization not found.");
	}

	if (selectedOrganization.name !== input.confirmation) {
		throw new DomainError(
			"Validation",
			"Type the organization name to confirm.",
		);
	}

	if (selectedOrganization.projects.length > 0) {
		throw new DomainError(
			"InvalidTransition",
			"Only organizations with zero projects can be deleted.",
		);
	}

	await (await getOrganizationAdapter(auth)).deleteOrganization(
		selectedOrganization.id,
	);

	await db.transaction(async (tx) => {
		await insertEvent(tx, {
			aggregateType: "organization",
			aggregateId: selectedOrganization.id,
			event: "deleted",
			actorId,
		});
	});
};
