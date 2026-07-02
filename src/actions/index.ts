import type { Auth } from "../lib/auth.ts";
import type { Db } from "../lib/database.ts";
import { ActionError, defineAction } from "astro:actions";
import { z } from "astro:schema";
import { eq } from "drizzle-orm";
import { events, phases } from "../lib/schema.ts";

export const assertAdmin = async (headers: Headers, auth: Auth) => {
	const session = await auth.api.getSession({ headers });

	if (!session) {
		throw new ActionError({
			code: "UNAUTHORIZED",
			message: "Sign in to manage projects.",
		});
	}

	if (session.user.role !== "admin") {
		throw new ActionError({
			code: "FORBIDDEN",
			message: "Only admins can manage projects.",
		});
	}

	return session;
};

export const assertOrganizationMember = async (
	headers: Headers,
	organizationId: string,
	auth: Auth,
	db: Db,
) => {
	const session = await auth.api.getSession({ headers });

	if (!session) {
		throw new ActionError({
			code: "UNAUTHORIZED",
			message: "Sign in to manage organization.",
		});
	}

	const member = await db.query.member.findFirst({
		where: {
			userId: session.user.id,
			organizationId,
		},
	});

	if (!member) {
		throw new ActionError({
			code: "FORBIDDEN",
			message: "You are not a member of this organization.",
		});
	}

	return session;
};

export const assertOrganizationOwnerOrAdmin = async (
	headers: Headers,
	organizationId: string,
	auth: Auth,
	db: Db,
) => {
	const session = await auth.api.getSession({ headers });

	if (!session) {
		throw new ActionError({
			code: "UNAUTHORIZED",
			message: "Sign in to manage organization.",
		});
	}

	const member = await db.query.member.findFirst({
		where: {
			userId: session.user.id,
			organizationId,
		},
	});

	if (!member || (member.role !== "owner" && member.role !== "admin")) {
		throw new ActionError({
			code: "FORBIDDEN",
			message: "Only organization owners or admins can perform this action.",
		});
	}

	return session;
};

const mutatePhaseState = async (
	phaseId: string,
	nextState: "approved" | "cancelled",
	eventName: "approved" | "declined",
	context: Parameters<Parameters<typeof defineAction>[0]["handler"]>[1],
) => {
	const phase = await context.locals.db.query.phases.findFirst({
		columns: {
			id: true,
			state: true,
		},
		with: {
			project: {
				columns: {
					organizationId: true,
				},
			},
		},
		where: {
			publicId: phaseId,
		},
	});

	if (!phase?.project) {
		throw new ActionError({ code: "NOT_FOUND", message: "Phase not found." });
	}

	const session = await assertOrganizationOwnerOrAdmin(
		context.request.headers,
		phase.project.organizationId,
		context.locals.auth,
		context.locals.db,
	);

	if (phase.state !== "planned") {
		throw new ActionError({
			code: "BAD_REQUEST",
			message: "Only planned phases can be approved or declined.",
		});
	}

	await context.locals.db.transaction(async (tx) => {
		await tx
			.update(phases)
			.set({ state: nextState })
			.where(eq(phases.id, phase.id));

		await tx.insert(events).values({
			publicId: crypto.randomUUID(),
			aggregateType: "milestone",
			aggregateId: phase.id,
			event: eventName,
			actorType: "user",
			actorId: session.user.id,
		});
	});

	return { success: true };
};

export const server = {
	approvePhase: defineAction({
		accept: "form",
		input: z.object({ phaseId: z.string() }),
		handler: (input, context) =>
			mutatePhaseState(input.phaseId, "approved", "approved", context),
	}),
	declinePhase: defineAction({
		accept: "form",
		input: z.object({ phaseId: z.string() }),
		handler: (input, context) =>
			mutatePhaseState(input.phaseId, "cancelled", "declined", context),
	}),
	// createProject: defineAction({
	// 	accept: "form",
	// 	input: z.object({
	// 		organizationId: z.string().trim().min(1, "Choose an organization."),
	// 		name: z.string().trim().min(1, "Enter a project name.").max(120),
	// 		deadline: z.coerce.date().optional(),
	// 		stateOfWork: z.string().trim().optional(),
	// 		stateOfPayment: z.string().trim().optional(),
	// 		budget: z.number().positive().optional(),
	// 		createdAt: z.coerce.date().optional(),
	// 	}),
	// 	handler: async (input, context) => {
	// 		await assertAdmin(context.request.headers, context.locals.auth);
	// 		const parsedInput = projectInsertSchema.safeParse(input);
	// 		if (!parsedInput.success) {
	// 			throw new ActionError({
	// 				code: "BAD_REQUEST",
	// 				message: "Invalid input data.",
	// 			});
	// 		}
	// 		const selectedOrganization =
	// 			await context.locals.db.query.organization.findFirst({
	// 				columns: {
	// 					id: true,
	// 				},
	// 				where: {
	// 					id: input.organizationId,
	// 				},
	// 			});
	// 		if (!selectedOrganization) {
	// 			throw new ActionError({
	// 				code: "BAD_REQUEST",
	// 				message: "Choose an existing organization.",
	// 			});
	// 		}
	// 		const rows = await context.locals.db
	// 			.insert(project)
	// 			.values(parsedInput.data)
	// 			.returning({ id: project.id });
	// 		return { id: rows[0]?.id };
	// 	},
	// }),
	// updateProject: defineAction({
	// 	accept: "form",
	// 	input: z.object({
	// 		projectId: z.string().trim().min(1, "Choose a project."),
	// 		name: z.string().trim().min(1, "Enter a project name.").max(120),
	// 		deadline: z.coerce.date().optional(),
	// 		stateOfWork: z.string().trim().optional(),
	// 		stateOfPayment: z.string().trim().optional(),
	// 		budget: z.number().positive().optional(),
	// 	}),
	// 	handler: async (input, context) => {
	// 		await assertAdmin(context.request.headers, context.locals.auth);
	// 		const selectedProject = await context.locals.db.query.project.findFirst({
	// 			columns: {
	// 				id: true,
	// 			},
	// 			where: {
	// 				id: input.projectId,
	// 			},
	// 		});
	// 		if (!selectedProject) {
	// 			throw new ActionError({
	// 				code: "BAD_REQUEST",
	// 				message: "Choose an existing project.",
	// 			});
	// 		}
	// 		const parsedInput = projectUpdateSchema.safeParse(input);
	// 		if (!parsedInput.success) {
	// 			throw new ActionError({
	// 				code: "BAD_REQUEST",
	// 				message: "Invalid input data.",
	// 			});
	// 		}
	// 		const rows = await context.locals.db
	// 			.update(project)
	// 			.set(parsedInput.data)
	// 			.where(eq(project.id, input.projectId))
	// 			.returning();
	// 		return { id: rows[0]?.id };
	// 	},
	// }),
	// deleteProject: defineAction({
	// 	accept: "form",
	// 	input: z.object({
	// 		projectId: z.string().trim().min(1, "Choose a project to delete."),
	// 	}),
	// 	handler: async ({ projectId }, context) => {
	// 		await assertAdmin(context.request.headers, context.locals.auth);
	// 		const selectedProject = await context.locals.db.query.project.findFirst({
	// 			columns: {
	// 				id: true,
	// 			},
	// 			where: {
	// 				id: projectId,
	// 			},
	// 		});
	// 		if (!selectedProject) {
	// 			throw new ActionError({
	// 				code: "BAD_REQUEST",
	// 				message: "Choose an existing project.",
	// 			});
	// 		}
	// 		await context.locals.db.delete(project).where(eq(project.id, projectId));
	// 		return { id: projectId };
	// 	},
	// }),
	// mutateOrganizationMetadata: defineAction({
	// 	accept: "form",
	// 	input: z.object({
	// 		organizationId: z.string().trim().min(1, "Choose an organization."),
	// 		yearlyBudget: z.coerce.number().int().positive().optional(),
	// 	}),
	// 	handler: async ({ organizationId, yearlyBudget }, context) => {
	// 		await assertOrganizationMember(
	// 			context.request.headers,
	// 			organizationId,
	// 			context.locals.auth,
	// 			context.locals.db,
	// 		);
	// 		const rows = await context.locals.db
	// 			.insert(organizationMetadata)
	// 			.values({
	// 				organizationId,
	// 				yearlyBudget: yearlyBudget ?? null,
	// 			})
	// 			.onConflictDoUpdate({
	// 				target: organizationMetadata.organizationId,
	// 				set: {
	// 					yearlyBudget: yearlyBudget ?? null,
	// 				},
	// 			})
	// 			.returning();
	// 		return { id: rows[0]?.id };
	// 	},
	// }),
};
