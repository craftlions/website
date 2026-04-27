import type { Auth } from "../lib/auth.ts";
import type { Db } from "../lib/database.ts";
import { ActionError, defineAction } from "astro:actions";
import { z } from "astro/zod";
import { eq, sql } from "drizzle-orm";
import { organizationMetadata, project } from "../lib/schema.ts";

const assertAdmin = async (headers: Headers, auth: Auth) => {
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

const assertOrganizationMember = async (
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

export const server = {
	createProject: defineAction({
		accept: "form",
		input: z.object({
			name: z.string().trim().min(1, "Enter a project name.").max(120),
			organizationId: z.string().trim().min(1, "Choose an organization."),
			deadline: z.string().trim().optional(),
			stateOfWork: z.string().trim().optional(),
			stateOfPayment: z.string().trim().optional(),
			amount: z.string().trim().optional(),
		}),
		handler: async (
			{ name, organizationId, deadline, stateOfWork, stateOfPayment, amount },
			context,
		) => {
			await assertAdmin(context.request.headers, context.locals.auth);

			const selectedOrganization =
				await context.locals.db.query.organization.findFirst({
					columns: {
						id: true,
					},
					where: {
						id: organizationId,
					},
				});

			if (!selectedOrganization) {
				throw new ActionError({
					code: "BAD_REQUEST",
					message: "Choose an existing organization.",
				});
			}

			const id = crypto.randomUUID();

			await context.locals.db.insert(project).values({
				id,
				organizationId,
				name,
				deadline: new Date(deadline ?? ""),
				stateOfWork: stateOfWork || null,
				stateOfPayment: stateOfPayment || null,
				budget: amount ? Number.parseInt(amount, 10) : null,
			});

			return { id };
		},
	}),
	updateProject: defineAction({
		accept: "form",
		input: z.object({
			projectId: z.string().trim().min(1, "Choose a project."),
			name: z.string().trim().min(1, "Enter a project name.").max(120),
			deadline: z.string().trim().optional(),
			stateOfWork: z.string().trim().optional(),
			stateOfPayment: z.string().trim().optional(),
			amount: z.string().trim().optional(),
		}),
		handler: async (
			{ projectId, name, deadline, stateOfWork, stateOfPayment, amount },
			context,
		) => {
			await assertAdmin(context.request.headers, context.locals.auth);

			const selectedProject = await context.locals.db.query.project.findFirst({
				columns: {
					id: true,
				},
				where: {
					id: projectId,
				},
			});

			if (!selectedProject) {
				throw new ActionError({
					code: "BAD_REQUEST",
					message: "Choose an existing project.",
				});
			}

			await context.locals.db
				.update(project)
				.set({
					name,
					deadline: new Date(deadline ?? ""),
					stateOfWork: stateOfWork || null,
					stateOfPayment: stateOfPayment || null,
					budget: amount ? Number.parseInt(amount, 10) : null,
				})
				.where(eq(project.id, projectId));

			return { id: projectId };
		},
	}),
	deleteProject: defineAction({
		accept: "form",
		input: z.object({
			projectId: z.string().trim().min(1, "Choose a project to delete."),
		}),
		handler: async ({ projectId }, context) => {
			await assertAdmin(context.request.headers, context.locals.auth);

			const selectedProject = await context.locals.db.query.project.findFirst({
				columns: {
					id: true,
				},
				where: {
					id: projectId,
				},
			});

			if (!selectedProject) {
				throw new ActionError({
					code: "BAD_REQUEST",
					message: "Choose an existing project.",
				});
			}

			await context.locals.db.delete(project).where(eq(project.id, projectId));

			return { id: projectId };
		},
	}),
	updateOrganizationMetadata: defineAction({
		accept: "form",
		input: z.object({
			organizationId: z.string().trim().min(1, "Choose an organization."),
			yearlyBudget: z.coerce
				.number()
				.int()
				.min(0, "Budget must be a non-negative number.")
				.optional(),
		}),
		handler: async ({ organizationId, yearlyBudget }, context) => {
			await assertOrganizationMember(
				context.request.headers,
				organizationId,
				context.locals.auth,
				context.locals.db,
			);

			const id = crypto.randomUUID();

			await context.locals.db
				.insert(organizationMetadata)
				.values({
					id,
					organizationId,
					yearlyBudget: yearlyBudget ?? null,
				})
				.onConflictDoUpdate({
					target: organizationMetadata.organizationId,
					set: {
						yearlyBudget: yearlyBudget ?? null,
						updatedAt: sql`(cast(unixepoch('subsecond') * 1000 as integer))`,
					},
				});

			return { id };
		},
	}),
};
