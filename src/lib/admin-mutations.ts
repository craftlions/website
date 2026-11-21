import type { Auth } from "./auth.ts";
import type { PublicIdPrefix } from "./public-id.ts";
import { getOrgAdapter } from "better-auth/plugins/organization";
import { and, eq, sql } from "drizzle-orm";
import { type Db, fulfilled } from "./database.ts";
import { resolveDelivery } from "./delivery.ts";
import { assertAdminUser, DomainError } from "./domain.ts";
import {
	type InvoiceComponent,
	isInvoiceComponentDue,
} from "./phase-billing.ts";
import { publicId } from "./public-id.ts";
import {
	events,
	invoices,
	organizationMetadata,
	phases,
	projects,
} from "./schema.ts";
import {
	type PhaseTransitionTarget,
	phaseTransitions,
	projectTransitions,
} from "./status.ts";
import { organizationStripeInvoices } from "./stripe.ts";

export const toSlug = (value: string) =>
	value
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "");

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

const resolvePhaseAmounts = (cost: number, input: PhaseAmountInput) => {
	const costUnits = phaseAmountUnits(cost);
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

type EventInput = {
	aggregateType: "invoice" | "organization" | "phase" | "project";
	aggregateId: string;
	aggregateVersion?: number;
	event: string;
	actorId: string;
};

const eventValues = (input: EventInput) => ({
	publicId: publicId("evt"),
	aggregateType: input.aggregateType,
	aggregateId: input.aggregateId,
	aggregateVersion: input.aggregateVersion,
	event: input.event,
	actorType: "user" as const,
	actorId: input.actorId,
});

const insertEvent = async (
	tx: Db | Parameters<Parameters<Db["transaction"]>[0]>[0],
	input: EventInput,
) => {
	const values = eventValues(input);

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

const isUniqueViolation = (error: unknown) => {
	const cause =
		error instanceof Error && "cause" in error ? error.cause : error;
	return (
		typeof cause === "object" &&
		cause !== null &&
		"code" in cause &&
		cause.code === "23505"
	);
};

const insertWithPublicId = async <Row>(
	prefix: PublicIdPrefix,
	insert: (id: string) => Promise<Row[]>,
) => {
	for (;;) {
		const [row] = await insert(publicId(prefix));

		if (row) {
			return row;
		}
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
			project: {
				columns: {},
				with: {
					organization: {
						columns: {},
						with: {
							members: { columns: { role: true }, where: { userId: actorId } },
						},
					},
				},
			},
		},
		where: { publicId: phasePublicId },
	});

	if (!phase?.project?.organization) {
		throw new DomainError("NotFound", "Phase not found.");
	}

	const membership = phase.project.organization.members[0];

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
	const [, selectedOrganization] = await Promise.all([
		assertAdminUser(db, actorId),
		db.query.organization.findFirst({
			columns: { id: true },
			where: { id: input.organizationId },
		}),
	]);

	if (!selectedOrganization) {
		throw new DomainError("NotFound", "Organization not found.");
	}

	return db.transaction(async (tx) => {
		const project = await insertWithPublicId("proj", (id) =>
			tx
				.insert(projects)
				.values({
					publicId: id,
					organizationId: input.organizationId,
					name: input.name.trim(),
					state: "draft",
				})
				.onConflictDoNothing({ target: projects.publicId })
				.returning({
					id: projects.id,
					publicId: projects.publicId,
					version: projects.version,
				}),
		);

		await insertEvent(tx, {
			aggregateType: "project",
			aggregateId: project.id,
			aggregateVersion: project.version,
			event: "created",
			actorId,
		});

		return project;
	});
};

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
			const recorded = await tx.query.events.findFirst({
				columns: { event: true },
				where: {
					aggregateType: "project",
					aggregateId: project.id,
					aggregateVersion: project.version,
				},
			});
			const transitions = Object.values(projectTransitions)
				.flat()
				.filter((transition) => transition.nextState === input.nextState);
			const transition =
				transitions.find(({ event }) => event === recorded?.event) ??
				transitions[0];

			if (transition) {
				return { idempotent: true, event: transition.event };
			}
		}

		if (project.version !== input.expectedVersion) {
			throw new DomainError(
				"Conflict",
				"This project was changed by another request. Refresh and try again.",
			);
		}

		const transition = projectTransitions[project.state].find(
			({ nextState }) => nextState === input.nextState,
		);

		if (!transition) {
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
			event: transition.event,
			actorId,
		});

		return { idempotent: false, event: transition.event };
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
	const amounts = resolvePhaseAmounts(input.cost, input);

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

		const phase = await insertWithPublicId("phs", (id) =>
			tx
				.insert(phases)
				.values({
					publicId: id,
					projectId: project.id,
					title: input.title.trim(),
					cost: input.cost,
					...amounts,
					currency: input.currency.toUpperCase(),
					state: "submitted",
					dueAt: input.dueAt ?? null,
				})
				.onConflictDoNothing({ target: phases.publicId })
				.returning({
					id: phases.id,
					publicId: phases.publicId,
					version: phases.version,
				}),
		);

		await insertEvent(tx, {
			aggregateType: "phase",
			aggregateId: phase.id,
			aggregateVersion: phase.version,
			event: "created",
			actorId,
		});

		return phase;
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

		const rows = await tx
			.update(phases)
			.set({
				...resolvePhaseAmounts(phase.cost, input),
				version: sql`${phases.version} + 1`,
			})
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

const transitionPhase = async (
	db: Db,
	actorId: string,
	phaseId: string,
	expectedVersion: number,
	nextState: PhaseTransitionTarget,
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
		nextState: PhaseTransitionTarget;
		expectedVersion: number;
	},
) => {
	await assertAdminUser(db, actorId);

	const transition = phaseTransitions[input.nextState];

	return transitionPhase(
		db,
		actorId,
		input.phaseId,
		input.expectedVersion,
		input.nextState,
		transition.from,
		transition.event,
		"Invalid phase transition.",
	);
};

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

export const attachInvoiceToPhase = async (
	db: Db,
	actorId: string,
	input: {
		stripeId: string;
		phaseId: string;
		component: InvoiceComponent;
		expectedVersion: number;
	},
) => {
	await assertAdminUser(db, actorId);

	return db.transaction(async (tx) => {
		const [phase] = await tx
			.select({
				id: phases.id,
				organizationId: projects.organizationId,
				currency: phases.currency,
				state: phases.state,
				version: phases.version,
				upfrontAmount: phases.upfrontAmount,
				deliveryAmount: phases.deliveryAmount,
				acceptanceAmount: phases.acceptanceAmount,
			})
			.from(phases)
			.innerJoin(projects, eq(phases.projectId, projects.id))
			.where(eq(phases.id, input.phaseId))
			.for("update", { of: phases });

		if (!phase) {
			throw new DomainError("NotFound", "Phase not found.");
		}

		if (phase[`${input.component}Amount`] === null) {
			throw new DomainError("Validation", "This component is not priced.");
		}

		const existing = await tx.query.invoices.findFirst({
			columns: { id: true, publicId: true, stripeId: true },
			where: { phaseId: phase.id, component: input.component },
		});

		if (existing?.stripeId === input.stripeId) {
			return {
				invoice: { id: existing.id, publicId: existing.publicId },
				created: false,
			};
		}

		if (phase.version !== input.expectedVersion) {
			throw new DomainError(
				"Conflict",
				"This phase was changed by another request. Refresh and try again.",
			);
		}

		if (existing) {
			throw new DomainError(
				"Conflict",
				"This component already has an invoice.",
			);
		}

		if (!isInvoiceComponentDue(input.component, phase.state)) {
			throw new DomainError(
				"InvalidTransition",
				`The ${input.component} component is not due yet.`,
			);
		}

		const stripeInvoice = await tx.query.stripeInvoices.findFirst({
			columns: { currency: true },
			where: {
				id: input.stripeId,
				...organizationStripeInvoices(phase.organizationId),
			},
		});

		if (!stripeInvoice) {
			throw new DomainError(
				"Validation",
				"Stripe invoice not found for this organization.",
			);
		}

		if (phase.currency !== stripeInvoice.currency) {
			throw new DomainError(
				"Validation",
				"Invoice currency does not match the phase currency.",
			);
		}

		const invoice = await insertWithPublicId("inv", async (id) => {
			try {
				return await tx
					.insert(invoices)
					.values({
						publicId: id,
						organizationId: phase.organizationId,
						phaseId: phase.id,
						component: input.component,
						stripeId: input.stripeId,
					})
					.onConflictDoNothing({ target: invoices.publicId })
					.returning({ id: invoices.id, publicId: invoices.publicId });
			} catch (error) {
				if (isUniqueViolation(error)) {
					throw new DomainError(
						"Conflict",
						"This invoice was attached by another request. Refresh and try again.",
					);
				}

				throw error;
			}
		});

		return { invoice, created: true };
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

		if (phase.state !== "delivered" && phase.state !== "accepted") {
			throw new DomainError(
				"InvalidTransition",
				"Delivery can only be updated for delivered or accepted phases.",
			);
		}

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

		const existingCreatedEvent = await tx.query.events.findFirst({
			columns: { id: true },
			where: {
				aggregateType: "organization",
				aggregateId: input.organizationId,
				event: "created",
			},
		});

		if (!existingCreatedEvent) {
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
	const email = input.email.trim().toLowerCase();
	const slug = toSlug(input.slug);
	let [, selectedUser, organization] = await Promise.all([
		assertAdminUser(db, actorId),
		db.query.user.findFirst({
			columns: { id: true, lastActiveAt: true },
			where: { email },
		}),
		db.query.organization.findFirst({
			columns: { id: true, name: true },
			where: { slug },
		}),
	]);

	if (organization) {
		if (!selectedUser) {
			throw new DomainError(
				"AlreadyExists",
				"That organization slug is taken.",
			);
		}

		const existingMember = await db.query.member.findFirst({
			columns: { id: true },
			where: {
				organizationId: organization.id,
				userId: selectedUser.id,
			},
		});

		if (!existingMember) {
			throw new DomainError(
				"AlreadyExists",
				"That organization slug is taken.",
			);
		}
	} else {
		if (!selectedUser) {
			const result = await auth.api.createUser({
				body: {
					email,
					name: input.name.trim(),
					password: crypto.randomUUID(),
				},
			});
			selectedUser = { id: result.user.id, lastActiveAt: null };
		}

		organization = await auth.api.createOrganization({
			body: {
				name: input.organizationName.trim(),
				slug,
				userId: selectedUser.id,
			},
		});
	}

	await writeOrganizationOnboardingRemainder(db, actorId, {
		organizationId: organization.id,
		yearlyBudget: input.yearlyBudget,
	});

	if (!selectedUser.lastActiveAt) {
		await auth.api.requestPasswordReset({
			body: { email, redirectTo: "/reset-password" },
		});
	}

	return organization;
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
	const email = input.email.trim().toLowerCase();
	let [, selectedUser] = await Promise.all([
		assertAdminUser(db, actorId),
		db.query.user.findFirst({
			columns: { id: true },
			where: { email },
		}),
	]);
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

	await insertEvent(db, {
		aggregateType: "organization",
		aggregateId: input.organizationId,
		event: existingMember ? "member_unchanged" : "member_added",
		actorId,
	});

	if (createdUser) {
		await auth.api.requestPasswordReset({
			body: { email, redirectTo: "/reset-password" },
		});
	}

	return {
		email,
		outcome: createdUser
			? ("invited" as const)
			: existingMember
				? ("unchanged" as const)
				: ("added" as const),
	};
};

export const removeOrganizationMember = async (
	db: Db,
	auth: Auth,
	actorId: string,
	input: { organizationId: string; memberId: string },
) => {
	const [, selectedMember] = await Promise.all([
		assertAdminUser(db, actorId),
		db.query.member.findFirst({
			columns: { id: true },
			where: {
				id: input.memberId,
				organizationId: input.organizationId,
			},
		}),
	]);

	if (!selectedMember) {
		throw new DomainError("NotFound", "Member not found.");
	}

	await (await getOrganizationAdapter(auth)).deleteMember({
		memberId: input.memberId,
		organizationId: input.organizationId,
	});

	await insertEvent(db, {
		aggregateType: "organization",
		aggregateId: input.organizationId,
		event: "member_removed",
		actorId,
	});
};

export const removeNeverLoggedInUser = async (
	db: Db,
	auth: Auth,
	actorId: string,
	input: { userId: string; confirmation: string },
) => {
	const [, selectedUser] = await Promise.all([
		assertAdminUser(db, actorId),
		db.query.user.findFirst({
			columns: { id: true, email: true, lastActiveAt: true },
			with: { memberships: { columns: { organizationId: true } } },
			where: { id: input.userId },
		}),
	]);

	if (!selectedUser) {
		throw new DomainError("NotFound", "User not found.");
	}

	if (input.confirmation !== selectedUser.email) {
		throw new DomainError("Validation", "Type the account's email to confirm.");
	}

	if (selectedUser.lastActiveAt) {
		throw new DomainError(
			"InvalidTransition",
			"Only never-logged-in users can be removed.",
		);
	}

	const context = await auth.$context;
	await context.internalAdapter.deleteUserSessions(input.userId);
	await context.internalAdapter.deleteUser(input.userId);

	if (selectedUser.memberships.length > 0) {
		await db.insert(events).values(
			selectedUser.memberships.map((membership) =>
				eventValues({
					aggregateType: "organization",
					aggregateId: membership.organizationId,
					event: "user_removed",
					actorId,
				}),
			),
		);
	}
};

export const updateOrganizationSettings = async (
	db: Db,
	auth: Auth,
	actorId: string,
	input: {
		organizationId: string;
		name?: string | undefined;
		slug?: string | undefined;
		logo?: string | null | undefined;
		yearlyBudget?: number | null | undefined;
		stripeCustomerId?: string | null | undefined;
	},
) => {
	await assertAdminUser(db, actorId);

	const slug = input.slug === undefined ? undefined : toSlug(input.slug);
	const adapter = await getOrganizationAdapter(auth);

	if (slug !== undefined) {
		const slugCollision = await adapter.findOrganizationBySlug(slug);

		if (slugCollision && slugCollision.id !== input.organizationId) {
			throw new DomainError(
				"AlreadyExists",
				"That organization slug is taken.",
			);
		}
	}

	const stripeCustomerId =
		input.stripeCustomerId === undefined
			? undefined
			: input.stripeCustomerId?.trim() || null;

	if (stripeCustomerId !== undefined) {
		const [metadata, attachedInvoice] = await db
			.pipeline([
				db.query.organizationMetadata.findFirst({
					columns: { stripeCustomerId: true },
					where: { organizationId: input.organizationId },
				}),
				db.query.invoices.findFirst({
					columns: { id: true },
					where: { organizationId: input.organizationId },
				}),
			])
			.then(fulfilled);

		if (
			attachedInvoice &&
			(metadata?.stripeCustomerId ?? null) !== stripeCustomerId
		) {
			throw new DomainError(
				"Conflict",
				"This organization has attached invoices, so its Stripe customer cannot change.",
			);
		}

		if (stripeCustomerId) {
			const customerOwner = await db.query.organizationMetadata.findFirst({
				columns: { organizationId: true },
				where: { stripeCustomerId },
			});

			if (
				customerOwner &&
				customerOwner.organizationId !== input.organizationId
			) {
				throw new DomainError(
					"AlreadyExists",
					"That Stripe customer is linked to another organization.",
				);
			}
		}
	}

	const organizationFields = {
		...(input.name !== undefined && { name: input.name.trim() }),
		...(slug !== undefined && { slug }),
		...(input.logo !== undefined && { logo: input.logo?.trim() || null }),
	};
	const organization =
		Object.keys(organizationFields).length > 0
			? await adapter.updateOrganization(
					input.organizationId,
					organizationFields,
				)
			: await db.query.organization.findFirst({
					columns: { id: true },
					where: { id: input.organizationId },
				});

	if (!organization) {
		throw new DomainError("NotFound", "Organization not found.");
	}

	const metadataFields = {
		...(input.yearlyBudget !== undefined && {
			yearlyBudget: input.yearlyBudget,
		}),
		...(stripeCustomerId !== undefined && { stripeCustomerId }),
	};

	const updatedEvent = db.insert(events).values(
		eventValues({
			aggregateType: "organization",
			aggregateId: input.organizationId,
			event: "updated",
			actorId,
		}),
	);
	const { metrics } =
		Object.keys(metadataFields).length > 0
			? await db.batch(
					[
						db
							.insert(organizationMetadata)
							.values({
								organizationId: input.organizationId,
								...metadataFields,
							})
							.onConflictDoUpdate({
								target: organizationMetadata.organizationId,
								set: metadataFields,
							}),
						updatedEvent,
					],
					{ metrics: "ms" },
				)
			: await db.batch([updatedEvent], { metrics: "ms" });
	const { queries, ...batch } = metrics;
	console.log("Organization settings batch", batch);
};

export const hardDeleteOrganization = async (
	db: Db,
	auth: Auth,
	actorId: string,
	input: { organizationId: string; confirmation: string },
) => {
	const [, selectedOrganization] = await Promise.all([
		assertAdminUser(db, actorId),
		db.query.organization.findFirst({
			columns: { id: true, name: true },
			with: {
				projects: { columns: { id: true }, limit: 1 },
				files: { columns: { id: true }, limit: 1 },
			},
			where: { id: input.organizationId },
		}),
	]);

	if (!selectedOrganization) {
		throw new DomainError("NotFound", "Organization not found.");
	}

	if (selectedOrganization.name !== input.confirmation) {
		throw new DomainError(
			"Validation",
			"Type the organization name to confirm.",
		);
	}

	if (
		selectedOrganization.projects.length > 0 ||
		selectedOrganization.files.length > 0
	) {
		throw new DomainError(
			"InvalidTransition",
			"Only organizations with zero projects and zero files can be deleted.",
		);
	}

	await (await getOrganizationAdapter(auth)).deleteOrganization(
		selectedOrganization.id,
	);

	await insertEvent(db, {
		aggregateType: "organization",
		aggregateId: selectedOrganization.id,
		event: "deleted",
		actorId,
	});

	return { name: selectedOrganization.name };
};
