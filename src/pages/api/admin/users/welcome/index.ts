import type { APIRoute } from "astro";
import { z } from "astro/zod";
import {
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
			email: z.string().trim().email(),
		})
		.safeParse(await context.request.json());

	if (!validation.success) {
		return problem(400, "Bad Request", z.prettifyError(validation.error));
	}

	await context.locals.auth.api.requestPasswordReset({
		body: { email: validation.data.email, redirectTo: "/reset-password" },
	});

	return new Response(null, { status: 204 });
};
