import type { Auth } from "./auth.ts";
import type { Db } from "./database.ts";
import { getOrgAdapter } from "better-auth/plugins/organization";
import { and, eq, isNull, sql } from "drizzle-orm";
import {
	events,
	invoices,
	organizationMetadata,
	phases,
	projects,
} from "./schema.ts";

export class DomainError extends Error {
	constructor(
		public code:
			| "AlreadyExists"
			| "Conflict"
			| "Forbidden"
			| "InvalidTransition"
			| "NotFound"
			| "StripeUnavailable"
			| "Validation",
		message: string,
	) {
		super(message);
	}
}

export const toSlug = (value: string) =>
	value
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "");

export const assertAdminUser = async (db: Db, actorId: string) => {
	const actor = await db.query.user.findFirst({
		columns: { id: true, role: true },
		where: { id: actorId },
	});

	if (actor?.role !== "admin") {
		throw new DomainError("Forbidden", "Only admins can perform this action.");
	}
};

const publicId = () => crypto.randomUUID();

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

export const approvePhaseAsClient = async (
	db: Db,
	actorId: string,
	input: {
		phasePublicId: string;
		event: "approved" | "declined";
		expectedVersion: number;
	},
) => {
	const phase = await db.query.phases.findFirst({
		columns: { id: true },
		with: {
			project: { columns: { organizationId: true } },
		},
		where: { publicId: input.phasePublicId },
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
		throw new DomainError(
			"Forbidden",
			"Only organization owners can approve or decline phases.",
		);
	}

	return transitionPhase(
		db,
		actorId,
		phase.id,
		input.expectedVersion,
		input.event === "approved" ? "approved" : "cancelled",
		["planned"],
		input.event,
		"Only planned phases can be approved or declined.",
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
					(phase) => !["paid", "cancelled"].includes(phase.state),
				)
			) {
				throw new DomainError(
					"InvalidTransition",
					"All phases must be paid or cancelled before completing a project.",
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
		currency: string;
		dueAt?: Date | null | undefined;
	},
) => {
	await assertAdminUser(db, actorId);

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

const phaseTransitions = {
	planned: { from: "submitted", event: "planned" },
	approved: { from: "planned", event: "approved_on_behalf" },
	in_progress: { from: "approved", event: "started" },
	cancelled: { from: ["submitted", "planned"], event: "cancelled" },
	paid: { from: "invoiced", event: "paid" },
} as const;

const transitionPhase = async (
	db: Db,
	actorId: string,
	phaseId: string,
	expectedVersion: number,
	nextState: "planned" | "approved" | "in_progress" | "cancelled" | "paid",
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

		if (nextState === "paid") {
			const invoice = await tx.query.invoices.findFirst({
				columns: { stripeStatus: true },
				where: { phaseId: phase.id },
			});

			if (invoice?.stripeStatus !== "paid") {
				throw new DomainError(
					"InvalidTransition",
					"Stripe must say paid before the payment can be confirmed.",
				);
			}
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
		nextState: "planned" | "approved" | "in_progress" | "cancelled" | "paid";
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

		const invoice = await tx.query.invoices.findFirst({
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
		const invoiceMatches =
			invoice?.phaseId === phase.id &&
			invoice.invoiceNumber === input.invoiceNumber.trim() &&
			invoice.stripeId === input.stripeId.trim() &&
			invoice.stripePaymentPage === input.stripePaymentPage.trim() &&
			invoice.currency === phase.currency &&
			invoice.total === input.total;

		if (
			phase.state === "invoiced" &&
			phase.version === input.expectedVersion + 1 &&
			invoiceMatches
		) {
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

		if (phase.state !== "in_progress") {
			throw new DomainError(
				"InvalidTransition",
				"Invoices can only be recorded on in-progress phases.",
			);
		}

		if (invoice) {
			throw new DomainError(
				"AlreadyExists",
				"This phase already has an invoice.",
			);
		}

		const project = await tx.query.projects.findFirst({
			columns: { organizationId: true },
			where: { id: phase.projectId },
		});

		if (!project) {
			throw new DomainError("NotFound", "Project not found.");
		}

		const rows = await tx
			.insert(invoices)
			.values({
				publicId: publicId(),
				organizationId: project.organizationId,
				phaseId: phase.id,
				invoiceNumber: input.invoiceNumber.trim(),
				stripeId: input.stripeId.trim(),
				stripePaymentPage: input.stripePaymentPage.trim(),
				currency: phase.currency,
				total: input.total,
			})
			.onConflictDoNothing()
			.returning({ id: invoices.id, publicId: invoices.publicId });

		if (!rows[0]) {
			throw new DomainError(
				"Conflict",
				"This invoice was recorded by another request. Refresh and try again.",
			);
		}

		const transitioned = await tx
			.update(phases)
			.set({ state: "invoiced", version: sql`${phases.version} + 1` })
			.where(
				and(
					eq(phases.id, phase.id),
					eq(phases.state, "in_progress"),
					eq(phases.version, input.expectedVersion),
				),
			)
			.returning({ id: phases.id });

		if (!transitioned[0]) {
			throw new DomainError(
				"Conflict",
				"This phase was changed by another request. Refresh and try again.",
			);
		}

		await insertEvent(tx, {
			aggregateType: "phase",
			aggregateId: phase.id,
			aggregateVersion: input.expectedVersion + 1,
			event: "invoiced",
			actorId,
		});

		return { invoice: rows[0], created: true };
	});
};

export const attachInvoiceToPhase = async (
	db: Db,
	actorId: string,
	input: { invoiceId: string; phaseId: string; expectedVersion: number },
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

		if (
			invoice.phaseId === phase.id &&
			phase.state === "invoiced" &&
			(phase.version === input.expectedVersion ||
				phase.version === input.expectedVersion + 1)
		) {
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

		if (phase.state !== "in_progress" && phase.state !== "invoiced") {
			throw new DomainError(
				"InvalidTransition",
				"Invoices can only be attached to in-progress or invoiced phases.",
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

		if (phase.state === "in_progress") {
			const transitioned = await tx
				.update(phases)
				.set({ state: "invoiced", version: sql`${phases.version} + 1` })
				.where(
					and(
						eq(phases.id, phase.id),
						eq(phases.state, "in_progress"),
						eq(phases.version, input.expectedVersion),
					),
				)
				.returning({ id: phases.id });

			if (!transitioned[0]) {
				throw new DomainError(
					"Conflict",
					"This phase was changed by another request. Refresh and try again.",
				);
			}

			await insertEvent(tx, {
				aggregateType: "phase",
				aggregateId: phase.id,
				aggregateVersion: input.expectedVersion + 1,
				event: "invoiced",
				actorId,
			});
		}

		return { idempotent: false };
	});
};

export const updateStoredStripeStatus = async (
	db: Db,
	input: {
		invoiceId: string;
		status: string | null;
		paidAt: Date | null;
		fetchedAt: Date;
	},
) => {
	await db
		.update(invoices)
		.set({
			stripeStatus: input.status,
			stripePaidAt: input.paidAt,
			fetchedAt: input.fetchedAt,
		})
		.where(eq(invoices.id, input.invoiceId));
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
