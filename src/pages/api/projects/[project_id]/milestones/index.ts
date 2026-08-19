import type { APIRoute } from "astro";
import { z } from "astro/zod";
import { createPhase } from "../../../../../lib/admin-mutations.ts";
import {
	domainProblem,
	problem,
	requireJson,
	verifyAdminApiKey,
} from "../../../../../lib/api-adapters.ts";

export const prerender = false;

export const POST: APIRoute = async (context) => {
	const verification = await verifyAdminApiKey(context);
	if (verification.response) return verification.response;

	const unsupported = requireJson(context.request);
	if (unsupported) return unsupported;

	const validation = z
		.strictObject({
			title: z.string().trim().min(1),
			cost: z.number().nonnegative(),
			upfrontAmount: z.number().nonnegative().nullable().optional(),
			deliveryAmount: z.number().nonnegative().nullable().optional(),
			acceptanceAmount: z.number().nonnegative().nullable().optional(),
			currency: z.string().trim().length(3),
			dueAt: z.coerce.date().optional(),
		})
		.safeParse(await context.request.json());

	if (!validation.success) {
		return problem(400, "Bad Request", z.prettifyError(validation.error));
	}

	try {
		const row = await createPhase(context.locals.db, verification.actorId, {
			projectId: String(context.params.project_id),
			...validation.data,
		});

		return new Response(JSON.stringify(row), {
			status: 201,
			headers: {
				"Content-Type": "application/json",
				Location: `/api/projects/${context.params.project_id}/milestones/${row.id}`,
			},
		});
	} catch (error) {
		return domainProblem(error);
	}
};
