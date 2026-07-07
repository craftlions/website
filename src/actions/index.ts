import type { Auth } from "../lib/auth.ts";
import type { Db } from "../lib/database.ts";
import { ActionError, defineAction } from "astro:actions";
import { z } from "astro:schema";
import { env } from "cloudflare:workers";
import {
	addOrganizationMember,
	approvePhaseAsClient,
	createPhase,
	createProject,
	DomainError,
	hardDeleteOrganization,
	onboardOrganization,
	recordInvoice,
	removeNeverLoggedInUser,
	removeOrganizationMember,
	toSlug,
	transitionPhaseAsAdmin,
	transitionProject,
	updateOrganizationSettings,
} from "../lib/admin-mutations.ts";
import { refreshStripeInvoice } from "../lib/stripe.ts";

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
			message: "Only organization owners can perform this action.",
		});
	}

	return session;
};

const actionCodeForDomainError = (error: DomainError): ActionError["code"] => {
	switch (error.code) {
		case "Forbidden":
			return "FORBIDDEN";
		case "NotFound":
			return "NOT_FOUND";
		case "AlreadyExists":
		case "InvalidTransition":
		case "Validation":
			return "BAD_REQUEST";
		case "StripeUnavailable":
			return "INTERNAL_SERVER_ERROR";
	}
};

const mapDomainError = (error: unknown): never => {
	if (error instanceof DomainError) {
		throw new ActionError({
			code: actionCodeForDomainError(error),
			message: error.message,
		});
	}

	throw error;
};

const adminHandler =
	<TInput, TResult>(
		handler: (
			input: TInput,
			context: Parameters<Parameters<typeof defineAction>[0]["handler"]>[1],
			actorId: string,
		) => Promise<TResult>,
	) =>
	async (
		input: TInput,
		context: Parameters<Parameters<typeof defineAction>[0]["handler"]>[1],
	) => {
		const session = await assertAdmin(
			context.request.headers,
			context.locals.auth,
		);

		try {
			return await handler(input, context, session.user.id);
		} catch (error) {
			return mapDomainError(error);
		}
	};

const clientPhaseHandler = async (
	phasePublicId: string,
	event: "approved" | "declined",
	context: Parameters<Parameters<typeof defineAction>[0]["handler"]>[1],
) => {
	const session = await context.locals.auth.api.getSession({
		headers: context.request.headers,
	});

	if (!session) {
		throw new ActionError({
			code: "UNAUTHORIZED",
			message: "Sign in to manage organization.",
		});
	}

	try {
		await approvePhaseAsClient(context.locals.db, session.user.id, {
			phasePublicId,
			event,
		});
		return { success: true };
	} catch (error) {
		return mapDomainError(error);
	}
};

const optionalBudget = z.preprocess(
	(value) => (value === "" || value === undefined ? undefined : value),
	z.coerce.number().int().positive().optional(),
);

export const server = {
	approvePhase: defineAction({
		accept: "form",
		input: z.object({ phaseId: z.string() }),
		handler: (input, context) =>
			clientPhaseHandler(input.phaseId, "approved", context),
	}),
	declinePhase: defineAction({
		accept: "form",
		input: z.object({ phaseId: z.string() }),
		handler: (input, context) =>
			clientPhaseHandler(input.phaseId, "declined", context),
	}),
	onboardOrganization: defineAction({
		accept: "form",
		input: z.object({
			email: z.string().trim().email(),
			name: z.string().trim().min(1).max(120),
			organizationName: z.string().trim().min(1).max(120),
			slug: z.string().trim().min(1).transform(toSlug),
			yearlyBudget: optionalBudget,
		}),
		handler: adminHandler(async (input, context, actorId) => {
			await onboardOrganization(
				context.locals.db,
				context.locals.auth,
				actorId,
				input,
			);
			return { success: true };
		}),
	}),
	createProject: defineAction({
		accept: "form",
		input: z.object({
			organizationId: z.string().trim().min(1),
			name: z.string().trim().min(1).max(160),
		}),
		handler: adminHandler(async (input, context, actorId) => {
			await createProject(context.locals.db, actorId, input);
			return { success: true };
		}),
	}),
	transitionProject: defineAction({
		accept: "form",
		input: z.object({
			projectId: z.string().trim().min(1),
			nextState: z.enum(["active", "completed", "archived"]),
		}),
		handler: adminHandler(async (input, context, actorId) => {
			await transitionProject(context.locals.db, actorId, input);
			return { success: true };
		}),
	}),
	createPhase: defineAction({
		accept: "form",
		input: z.object({
			projectId: z.string().trim().min(1),
			title: z.string().trim().min(1).max(180),
			cost: z.coerce.number().nonnegative(),
			currency: z.string().trim().length(3),
			dueAt: z.preprocess(
				(value) => (value === "" ? null : value),
				z.coerce.date().nullable().optional(),
			),
		}),
		handler: adminHandler(async (input, context, actorId) => {
			await createPhase(context.locals.db, actorId, input);
			return { success: true };
		}),
	}),
	transitionPhase: defineAction({
		accept: "form",
		input: z.object({
			phaseId: z.string().trim().min(1),
			nextState: z.enum([
				"planned",
				"approved",
				"in_progress",
				"cancelled",
				"paid",
			]),
		}),
		handler: adminHandler(async (input, context, actorId) => {
			await transitionPhaseAsAdmin(context.locals.db, actorId, input);
			return { success: true };
		}),
	}),
	recordInvoice: defineAction({
		accept: "form",
		input: z.object({
			phaseId: z.string().trim().min(1),
			invoiceNumber: z.string().trim().min(1).max(80),
			stripeId: z.string().trim().min(1).max(140),
			stripePaymentPage: z.string().trim().url(),
			total: z.coerce.number().nonnegative(),
		}),
		handler: adminHandler(async (input, context, actorId) => {
			await recordInvoice(context.locals.db, actorId, input);
			return { success: true };
		}),
	}),
	refreshStripeInvoice: defineAction({
		accept: "form",
		input: z.object({ invoiceId: z.string().trim().min(1) }),
		handler: adminHandler(async (input, context) => {
			await refreshStripeInvoice(context.locals.db, {
				invoiceId: input.invoiceId,
				stripeKey: env.STRIPE_SECRET_KEY,
			});
			return { success: true };
		}),
	}),
	addOrganizationMember: defineAction({
		accept: "form",
		input: z.object({
			organizationId: z.string().trim().min(1),
			email: z.string().trim().email(),
			name: z.string().trim().min(1).max(120),
			role: z.enum(["owner", "member"]).default("member"),
		}),
		handler: adminHandler(async (input, context, actorId) => {
			await addOrganizationMember(
				context.locals.db,
				context.locals.auth,
				actorId,
				input,
			);
			return { success: true };
		}),
	}),
	removeOrganizationMember: defineAction({
		accept: "form",
		input: z.object({
			organizationId: z.string().trim().min(1),
			memberId: z.string().trim().min(1),
		}),
		handler: adminHandler(async (input, context, actorId) => {
			await removeOrganizationMember(
				context.locals.db,
				context.locals.auth,
				actorId,
				input,
			);
			return { success: true };
		}),
	}),
	resendWelcomeMail: defineAction({
		accept: "form",
		input: z.object({ email: z.string().trim().email() }),
		handler: adminHandler(async (input, context) => {
			await context.locals.auth.api.requestPasswordReset({
				body: { email: input.email, redirectTo: "/reset-password" },
			});
			return { success: true };
		}),
	}),
	removeNeverLoggedInUser: defineAction({
		accept: "form",
		input: z.object({ userId: z.string().trim().min(1) }),
		handler: adminHandler(async (input, context, actorId) => {
			await removeNeverLoggedInUser(
				context.locals.db,
				context.locals.auth,
				actorId,
				input,
			);
			return { success: true };
		}),
	}),
	updateOrganizationSettings: defineAction({
		accept: "form",
		input: z.object({
			organizationId: z.string().trim().min(1),
			name: z.string().trim().min(1).max(120),
			slug: z.string().trim().min(1).transform(toSlug),
			logo: z.preprocess(
				(value) => (value === "" ? null : value),
				z.string().trim().url().nullable().optional(),
			),
			yearlyBudget: optionalBudget,
		}),
		handler: adminHandler(async (input, context, actorId) => {
			await updateOrganizationSettings(
				context.locals.db,
				context.locals.auth,
				actorId,
				input,
			);
			return { success: true };
		}),
	}),
	hardDeleteOrganization: defineAction({
		accept: "form",
		input: z.object({
			organizationId: z.string().trim().min(1),
			confirmation: z.string().trim().min(1),
		}),
		handler: adminHandler(async (input, context, actorId) => {
			await hardDeleteOrganization(
				context.locals.db,
				context.locals.auth,
				actorId,
				input,
			);
			return { success: true };
		}),
	}),
};
