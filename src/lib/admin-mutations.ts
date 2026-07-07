import type { Auth } from "./auth.ts";
import type { Db } from "./database.ts";
import { getOrgAdapter } from "better-auth/plugins/organization";
import { and, eq } from "drizzle-orm";
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
		event: string;
		actorId: string;
	},
) => {
	await tx.insert(events).values({
		publicId: publicId(),
		aggregateType: input.aggregateType,
		aggregateId: input.aggregateId,
		event: input.event,
		actorType: "user",
		actorId: input.actorId,
	});
};

export const approvePhaseAsClient = async (
	db: Db,
	actorId: string,
	input: { phasePublicId: string; event: "approved" | "declined" },
) => {
	const phase = await db.query.phases.findFirst({
		columns: { id: true, state: true },
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

	if (phase.state !== "planned") {
		throw new DomainError(
			"InvalidTransition",
			"Only planned phases can be approved or declined.",
		);
	}

	await db.transaction(async (tx) => {
		await tx
			.update(phases)
			.set({ state: input.event === "approved" ? "approved" : "cancelled" })
			.where(eq(phases.id, phase.id));
		await insertEvent(tx, {
			aggregateType: "phase",
			aggregateId: phase.id,
			event: input.event,
			actorId,
		});
	});
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
			.returning({ id: projects.id, publicId: projects.publicId });

		if (!rows[0]) {
			throw new DomainError("Validation", "Project could not be created.");
		}

		await insertEvent(tx, {
			aggregateType: "project",
			aggregateId: rows[0].id,
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
	input: { projectId: string; nextState: "active" | "completed" | "archived" },
) => {
	await assertAdminUser(db, actorId);

	const project = await db.query.projects.findFirst({
		columns: { id: true, state: true },
		with: { phases: { columns: { state: true } } },
		where: { id: input.projectId },
	});

	if (!project) {
		throw new DomainError("NotFound", "Project not found.");
	}

	const valid =
		(project.state === "draft" && input.nextState === "active") ||
		(project.state === "active" && input.nextState === "completed") ||
		(project.state === "completed" && input.nextState === "active") ||
		(project.state === "completed" && input.nextState === "archived");

	if (!valid) {
		throw new DomainError("InvalidTransition", "Invalid project transition.");
	}

	if (
		project.state === "active" &&
		input.nextState === "completed" &&
		project.phases.some((phase) => !["paid", "cancelled"].includes(phase.state))
	) {
		throw new DomainError(
			"InvalidTransition",
			"All phases must be paid or cancelled before completing a project.",
		);
	}

	await db.transaction(async (tx) => {
		await tx
			.update(projects)
			.set({ state: input.nextState })
			.where(eq(projects.id, project.id));
		await insertEvent(tx, {
			aggregateType: "project",
			aggregateId: project.id,
			event:
				project.state === "completed" && input.nextState === "active"
					? "reopened"
					: nextProjectEvents[input.nextState],
			actorId,
		});
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

	const project = await db.query.projects.findFirst({
		columns: { id: true, state: true },
		where: { id: input.projectId },
	});

	if (!project) {
		throw new DomainError("NotFound", "Project not found.");
	}

	if (!["draft", "active"].includes(project.state)) {
		throw new DomainError(
			"InvalidTransition",
			"Phases can only be created on draft or active projects.",
		);
	}

	return db.transaction(async (tx) => {
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
			.returning({ id: phases.id, publicId: phases.publicId });

		if (!rows[0]) {
			throw new DomainError("Validation", "Phase could not be created.");
		}

		await insertEvent(tx, {
			aggregateType: "phase",
			aggregateId: rows[0].id,
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

export const transitionPhaseAsAdmin = async (
	db: Db,
	actorId: string,
	input: {
		phaseId: string;
		nextState: "planned" | "approved" | "in_progress" | "cancelled" | "paid";
	},
) => {
	await assertAdminUser(db, actorId);

	const phase = await db.query.phases.findFirst({
		columns: { id: true, state: true },
		with: {
			invoice: {
				columns: { stripeStatus: true },
			},
		},
		where: { id: input.phaseId },
	});

	if (!phase) {
		throw new DomainError("NotFound", "Phase not found.");
	}

	const transition = phaseTransitions[input.nextState];
	const from = Array.isArray(transition.from)
		? transition.from
		: [transition.from];

	if (!from.includes(phase.state as never)) {
		throw new DomainError("InvalidTransition", "Invalid phase transition.");
	}

	if (input.nextState === "paid" && phase.invoice?.stripeStatus !== "paid") {
		throw new DomainError(
			"InvalidTransition",
			"Stripe must say paid before the payment can be confirmed.",
		);
	}

	await db.transaction(async (tx) => {
		await tx
			.update(phases)
			.set({ state: input.nextState })
			.where(eq(phases.id, phase.id));
		await insertEvent(tx, {
			aggregateType: "phase",
			aggregateId: phase.id,
			event: transition.event,
			actorId,
		});
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
	},
) => {
	await assertAdminUser(db, actorId);

	const phase = await db.query.phases.findFirst({
		columns: { id: true, state: true },
		with: { invoice: { columns: { id: true } } },
		where: { id: input.phaseId },
	});

	if (!phase) {
		throw new DomainError("NotFound", "Phase not found.");
	}

	if (phase.state !== "in_progress") {
		throw new DomainError(
			"InvalidTransition",
			"Invoices can only be recorded on in-progress phases.",
		);
	}

	if (phase.invoice) {
		throw new DomainError(
			"AlreadyExists",
			"This phase already has an invoice.",
		);
	}

	return db.transaction(async (tx) => {
		const rows = await tx
			.insert(invoices)
			.values({
				publicId: publicId(),
				phaseId: phase.id,
				invoiceNumber: input.invoiceNumber.trim(),
				stripeId: input.stripeId.trim(),
				stripePaymentPage: input.stripePaymentPage.trim(),
				total: input.total,
			})
			.returning({ id: invoices.id, publicId: invoices.publicId });

		if (!rows[0]) {
			throw new DomainError("Validation", "Invoice could not be recorded.");
		}

		await tx
			.update(phases)
			.set({ state: "invoiced" })
			.where(eq(phases.id, phase.id));
		await insertEvent(tx, {
			aggregateType: "phase",
			aggregateId: phase.id,
			event: "invoiced",
			actorId,
		});

		return rows[0];
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
			})
			.onConflictDoUpdate({
				target: organizationMetadata.organizationId,
				set: { yearlyBudget: input.yearlyBudget ?? null },
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
