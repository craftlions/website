import { ActionError, defineAction } from "astro:actions";
import { z } from "astro/zod";
import { eq } from "drizzle-orm";
import { auth } from "../lib/auth.ts";
import { db } from "../lib/database.ts";
import { project } from "../lib/schema.ts";

const assertAdmin = async (headers: Headers) => {
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

export const server = {
	createProject: defineAction({
		accept: "form",
		input: z.object({
			name: z.string().trim().min(1, "Enter a project name.").max(120),
			organizationId: z.string().trim().min(1, "Choose an organization."),
		}),
		handler: async ({ name, organizationId }, context) => {
			await assertAdmin(context.request.headers);

			const selectedOrganization = await db.query.organization.findFirst({
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

			await db.insert(project).values({
				id,
				organizationId,
				name,
			});

			return { id };
		},
	}),
	deleteProject: defineAction({
		accept: "form",
		input: z.object({
			projectId: z.string().trim().min(1, "Choose a project to delete."),
		}),
		handler: async ({ projectId }, context) => {
			await assertAdmin(context.request.headers);

			const selectedProject = await db.query.project.findFirst({
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

			await db.delete(project).where(eq(project.id, projectId));

			return { id: projectId };
		},
	}),
};
