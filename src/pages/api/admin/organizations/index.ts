import type { APIRoute } from "astro";
import { z } from "astro/zod";
import { onboardOrganization } from "../../../../lib/admin-mutations.ts";
import {
	domainProblem,
	problem,
	requireJson,
	verifyAdminApiKey,
} from "../../../../lib/api-adapters.ts";

export const prerender = false;

export const POST: APIRoute = async (context) => {
	const verification = await verifyAdminApiKey(context);
	if (verification.response) return verification.response;

	const unsupported = requireJson(context.request);
	if (unsupported) return unsupported;

	const validation = z
		.strictObject({
			email: z.string().trim().email(),
			name: z.string().trim().min(1),
			organizationName: z.string().trim().min(1),
			slug: z.string().trim().min(1),
			yearlyBudget: z.number().int().positive().nullable().optional(),
		})
		.safeParse(await context.request.json());

	if (!validation.success) {
		return problem(400, "Bad Request", z.prettifyError(validation.error));
	}

	try {
		const organization = await onboardOrganization(
			context.locals.db,
			context.locals.auth,
			verification.actorId,
			validation.data,
		);
		return new Response(JSON.stringify(organization), {
			status: 201,
			headers: { "Content-Type": "application/json" },
		});
	} catch (error) {
		return domainProblem(error);
	}
};
