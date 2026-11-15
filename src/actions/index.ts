import { ActionError, defineAction } from "astro:actions";
import { z } from "astro/zod";
import {
	acceptPhaseAsClient,
	addOrganizationMember,
	approvePhaseAsClient,
	attachInvoiceToPhase,
	createPhase,
	createProject,
	hardDeleteOrganization,
	onboardOrganization,
	recordDelivery,
	removeNeverLoggedInUser,
	removeOrganizationMember,
	toSlug,
	transitionPhaseAsAdmin,
	transitionProject,
	updateOrganizationSettings,
	updatePhaseAmounts,
	updatePhaseDelivery,
} from "../lib/admin-mutations.ts";
import {
	deliveryChoiceSchema,
	deliveryPairingIssue,
	deliveryUrlSchema,
} from "../lib/delivery.ts";
import { DomainError } from "../lib/domain.ts";

type ActionContext = Parameters<
	Parameters<typeof defineAction>[0]["handler"]
>[1];

// Form actions run inside the middleware, which already loaded the session for
// /admin and /dash pages; only RPC calls need their own session read.
const getSession = async (context: ActionContext) =>
	context.locals.session === undefined
		? context.locals.auth.api.getSession({ headers: context.request.headers })
		: context.locals.session;

const assertAdmin = async (context: ActionContext) => {
	const session = await getSession(context);

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

const actionCodeForDomainError = (error: DomainError): ActionError["code"] => {
	switch (error.code) {
		case "Forbidden":
			return "FORBIDDEN";
		case "NotFound":
			return "NOT_FOUND";
		case "Conflict":
			return "CONFLICT";
		case "AlreadyExists":
		case "InvalidTransition":
		case "Validation":
			return "BAD_REQUEST";
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
			context: ActionContext,
			actorId: string,
		) => Promise<TResult>,
	) =>
	async (input: TInput, context: ActionContext) => {
		const session = await assertAdmin(context);

		try {
			return await handler(input, context, session.user.id);
		} catch (error) {
			return mapDomainError(error);
		}
	};

const clientPhaseHandler = async (
	phasePublicId: string,
	event: "approved" | "declined" | "accepted",
	expectedVersion: number,
	context: ActionContext,
) => {
	const session = await getSession(context);

	if (!session) {
		throw new ActionError({
			code: "UNAUTHORIZED",
			message: "Sign in to manage organization.",
		});
	}

	try {
		if (event === "accepted") {
			await acceptPhaseAsClient(context.locals.db, session.user.id, {
				phasePublicId,
				expectedVersion,
			});
		} else {
			await approvePhaseAsClient(context.locals.db, session.user.id, {
				phasePublicId,
				event,
				expectedVersion,
			});
		}
		return { success: true };
	} catch (error) {
		return mapDomainError(error);
	}
};

const optionalBudget = z.preprocess(
	(value) => (value === "" || value === undefined ? undefined : value),
	z.coerce.number().int().positive().optional(),
);

const optionalPhaseAmount = z.preprocess(
	(value) => (value === "" || value === undefined ? null : Number(value)),
	z.number().nonnegative().nullable(),
);

// Checked after normalising, so input like "!!!" that normalises to nothing
// is rejected instead of saved as an empty slug.
const slugSchema = z
	.string()
	.transform(toSlug)
	.pipe(z.string().min(1, "Use at least one letter or digit."));

export const server = {
	approvePhase: defineAction({
		accept: "form",
		input: z.object({
			phaseId: z.string(),
			expectedVersion: z.coerce.number().int().nonnegative(),
		}),
		handler: (input, context) =>
			clientPhaseHandler(
				input.phaseId,
				"approved",
				input.expectedVersion,
				context,
			),
	}),
	declinePhase: defineAction({
		accept: "form",
		input: z.object({
			phaseId: z.string(),
			expectedVersion: z.coerce.number().int().nonnegative(),
		}),
		handler: (input, context) =>
			clientPhaseHandler(
				input.phaseId,
				"declined",
				input.expectedVersion,
				context,
			),
	}),
	acceptPhase: defineAction({
		accept: "form",
		input: z.object({
			phaseId: z.string(),
			expectedVersion: z.coerce.number().int().nonnegative(),
		}),
		handler: (input, context) =>
			clientPhaseHandler(
				input.phaseId,
				"accepted",
				input.expectedVersion,
				context,
			),
	}),
	onboardOrganization: defineAction({
		accept: "form",
		input: z.object({
			email: z.string().trim().pipe(z.email()),
			name: z.string().trim().min(1).max(120),
			organizationName: z.string().trim().min(1).max(120),
			slug: slugSchema,
			yearlyBudget: optionalBudget,
		}),
		handler: adminHandler(async (input, context, actorId) => {
			const organization = await onboardOrganization(
				context.locals.db,
				context.locals.auth,
				actorId,
				input,
			);
			// A repeated onboarding returns the existing client by id only.
			return {
				id: organization.id,
				name:
					"name" in organization ? organization.name : input.organizationName,
			};
		}),
	}),
	createProject: defineAction({
		accept: "form",
		input: z.object({
			organizationId: z.string().trim().min(1),
			name: z.string().trim().min(1).max(160),
		}),
		handler: adminHandler(async (input, context, actorId) => {
			const project = await createProject(context.locals.db, actorId, input);
			// The admin continues on the new project's page to add its phases.
			return {
				publicId: project.publicId,
				next: `/admin/org/${encodeURIComponent(input.organizationId)}/projects/${project.publicId}`,
			};
		}),
	}),
	transitionProject: defineAction({
		accept: "form",
		input: z.object({
			projectId: z.string().trim().min(1),
			nextState: z.enum(["active", "completed", "archived"]),
			expectedVersion: z.coerce.number().int().nonnegative(),
		}),
		handler: adminHandler(async (input, context, actorId) => {
			const { event } = await transitionProject(
				context.locals.db,
				actorId,
				input,
			);
			return { projectId: input.projectId, state: input.nextState, event };
		}),
	}),
	createPhase: defineAction({
		accept: "form",
		input: z.object({
			projectId: z.string().trim().min(1),
			title: z.string().trim().min(1).max(180),
			cost: z.coerce.number().nonnegative(),
			upfrontAmount: optionalPhaseAmount,
			deliveryAmount: optionalPhaseAmount,
			acceptanceAmount: optionalPhaseAmount,
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
	updatePhaseAmounts: defineAction({
		accept: "form",
		input: z.object({
			phaseId: z.string().trim().min(1),
			expectedVersion: z.coerce.number().int().nonnegative(),
			upfrontAmount: optionalPhaseAmount,
			deliveryAmount: optionalPhaseAmount,
			acceptanceAmount: optionalPhaseAmount,
		}),
		handler: adminHandler(async (input, context, actorId) => {
			await updatePhaseAmounts(context.locals.db, actorId, input);
			return { phaseId: input.phaseId };
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
				"accepted",
				"cancelled",
			]),
			expectedVersion: z.coerce.number().int().nonnegative(),
		}),
		handler: adminHandler(async (input, context, actorId) => {
			await transitionPhaseAsAdmin(context.locals.db, actorId, input);
			// A transition only succeeds once the phase is in the requested state.
			return { phaseId: input.phaseId, state: input.nextState };
		}),
	}),
	recordDelivery: defineAction({
		accept: "form",
		input: z
			.object({
				phaseId: z.string().trim().min(1),
				expectedVersion: z.coerce.number().int().nonnegative(),
				deliveryChoice: deliveryChoiceSchema,
				deliveryUrl: deliveryUrlSchema,
			})
			.superRefine(deliveryPairingIssue),
		handler: adminHandler(async (input, context, actorId) => {
			await recordDelivery(context.locals.db, actorId, input);
			return { phaseId: input.phaseId };
		}),
	}),
	attachInvoiceToPhase: defineAction({
		accept: "form",
		input: z.object({
			stripeId: z.string().trim().min(1).max(140),
			target: z.string().regex(/^[^:]+:(upfront|delivery|acceptance):\d+$/),
		}),
		handler: adminHandler(async (input, context, actorId) => {
			const [phaseId, component, expectedVersion] = input.target.split(":");
			await attachInvoiceToPhase(context.locals.db, actorId, {
				stripeId: input.stripeId,
				phaseId: phaseId ?? "",
				component: component as "upfront" | "delivery" | "acceptance",
				expectedVersion: Number(expectedVersion),
			});
			return { success: true };
		}),
	}),
	updatePhaseDelivery: defineAction({
		accept: "form",
		input: z
			.object({
				phaseId: z.string().trim().min(1),
				expectedVersion: z.coerce.number().int().nonnegative(),
				deliveryChoice: deliveryChoiceSchema,
				deliveryUrl: deliveryUrlSchema,
			})
			.superRefine(deliveryPairingIssue),
		handler: adminHandler(async (input, context, actorId) => {
			await updatePhaseDelivery(context.locals.db, actorId, input);
			return { phaseId: input.phaseId };
		}),
	}),
	addOrganizationMember: defineAction({
		accept: "form",
		input: z.object({
			organizationId: z.string().trim().min(1),
			email: z.string().trim().pipe(z.email()),
			name: z.string().trim().min(1).max(120),
			role: z.enum(["owner", "member"]).default("member"),
		}),
		handler: adminHandler((input, context, actorId) =>
			addOrganizationMember(
				context.locals.db,
				context.locals.auth,
				actorId,
				input,
			),
		),
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
		input: z.object({ email: z.string().trim().pipe(z.email()) }),
		handler: adminHandler(async (input, context) => {
			await context.locals.auth.api.requestPasswordReset({
				body: { email: input.email, redirectTo: "/reset-password" },
			});
			return { email: input.email };
		}),
	}),
	removeNeverLoggedInUser: defineAction({
		accept: "form",
		input: z.object({
			userId: z.string().trim().min(1),
			confirmation: z.string().trim().min(1),
		}),
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
			slug: slugSchema,
			logo: z.preprocess(
				(value) => (value === "" ? null : value),
				z.string().trim().pipe(z.url()).nullable().optional(),
			),
			yearlyBudget: optionalBudget,
			stripeCustomerId: z.preprocess(
				(value) => (value === "" ? null : value),
				z.string().trim().startsWith("cus_").nullable().optional(),
			),
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
			const { name } = await hardDeleteOrganization(
				context.locals.db,
				context.locals.auth,
				actorId,
				input,
			);
			// The client's pages are gone; the admin continues on /admin.
			return { name, next: "/admin" };
		}),
	}),
};
