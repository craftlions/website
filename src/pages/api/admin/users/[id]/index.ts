import type { APIRoute } from "astro";
import { removeNeverLoggedInUser } from "../../../../../lib/admin-mutations.ts";
import {
	domainProblem,
	verifyAdminApiKey,
} from "../../../../../lib/api-adapters.ts";

export const prerender = false;

export const DELETE: APIRoute = async (context) => {
	const verification = await verifyAdminApiKey(context);
	if (verification.response) return verification.response;

	try {
		await removeNeverLoggedInUser(
			context.locals.db,
			context.locals.auth,
			verification.actorId,
			{ userId: String(context.params.id) },
		);
		return new Response(null, { status: 204 });
	} catch (error) {
		return domainProblem(error);
	}
};
