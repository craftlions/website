import type { APIRoute } from "astro";
import { z } from "astro/zod";
import { updateOrganizationSettings } from "../../../../../../lib/admin-mutations.ts";
import {
	domainProblem,
	problem,
	requireJson,
	verifyAdminApiKey,
} from "../../../../../../lib/api-adapters.ts";

export const prerender = false;

export const PATCH: APIRoute = async (context) => {
	const verification = await verifyAdminApiKey(context);
	if (verification.response) return verification.response;

	const unsupported = requireJson(context.request);
	if (unsupported) return unsupported;

	const validation = z
		.strictObject({
			name: z.string().trim().min(1),
			slug: z.string().trim().min(1),
			logo: z.string().trim().url().nullable().optional(),
			yearlyBudget: z.number().int().positive().nullable().optional(),
		})
		.safeParse(await context.request.json());

	if (!validation.success) {
		return problem(400, "Bad Request", z.prettifyError(validation.error));
	}

	try {
		await updateOrganizationSettings(
			context.locals.db,
			context.locals.auth,
			verification.actorId,
			{
				organizationId: String(context.params.id),
				...validation.data,
			},
		);
		return new Response(null, { status: 204 });
	} catch (error) {
		return domainProblem(error);
	}
};
