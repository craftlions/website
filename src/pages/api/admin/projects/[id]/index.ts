import type { APIRoute } from "astro";
import { z } from "astro/zod";
import { transitionProject } from "../../../../../lib/admin-mutations.ts";
import {
	domainProblem,
	problem,
	requireJson,
	verifyAdminApiKey,
} from "../../../../../lib/api-adapters.ts";

export const prerender = false;

export const PATCH: APIRoute = async (context) => {
	const verification = await verifyAdminApiKey(context);
	if (verification.response) return verification.response;

	const unsupported = requireJson(context.request);
	if (unsupported) return unsupported;

	const validation = z
		.strictObject({
			nextState: z.enum(["active", "completed", "archived"]),
		})
		.safeParse(await context.request.json());

	if (!validation.success) {
		return problem(400, "Bad Request", z.prettifyError(validation.error));
	}

	try {
		await transitionProject(context.locals.db, verification.actorId, {
			projectId: String(context.params.id),
			nextState: validation.data.nextState,
		});
		return new Response(null, { status: 204 });
	} catch (error) {
		return domainProblem(error);
	}
};
