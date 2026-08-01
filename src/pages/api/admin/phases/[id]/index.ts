import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { z } from "astro/zod";
import { transitionPhaseAsAdmin } from "../../../../../lib/admin-mutations.ts";
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
			nextState: z.enum([
				"planned",
				"approved",
				"in_progress",
				"cancelled",
				"paid",
			]),
			expectedVersion: z.number().int().nonnegative(),
		})
		.safeParse(await context.request.json());

	if (!validation.success) {
		return problem(400, "Bad Request", z.prettifyError(validation.error));
	}

	try {
		await transitionPhaseAsAdmin(context.locals.db, verification.actorId, {
			phaseId: String(context.params.id),
			nextState: validation.data.nextState,
			expectedVersion: validation.data.expectedVersion,
			activationTimestamp: env.NOTIFICATION_ACTIVATION_TS,
		});
		return new Response(null, { status: 204 });
	} catch (error) {
		return domainProblem(error);
	}
};
