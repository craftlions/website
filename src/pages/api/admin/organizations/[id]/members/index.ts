import type { APIRoute } from "astro";
import { z } from "astro/zod";
import {
	addOrganizationMember,
	removeOrganizationMember,
} from "../../../../../../lib/admin-mutations.ts";
import {
	domainProblem,
	problem,
	requireJson,
	verifyAdminApiKey,
} from "../../../../../../lib/api-adapters.ts";

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
			role: z.enum(["owner", "member"]).default("member"),
		})
		.safeParse(await context.request.json());

	if (!validation.success) {
		return problem(400, "Bad Request", z.prettifyError(validation.error));
	}

	try {
		await addOrganizationMember(
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

export const DELETE: APIRoute = async (context) => {
	const verification = await verifyAdminApiKey(context);
	if (verification.response) return verification.response;

	const unsupported = requireJson(context.request);
	if (unsupported) return unsupported;

	const validation = z
		.strictObject({
			memberId: z.string().trim().min(1),
		})
		.safeParse(await context.request.json());

	if (!validation.success) {
		return problem(400, "Bad Request", z.prettifyError(validation.error));
	}

	try {
		await removeOrganizationMember(
			context.locals.db,
			context.locals.auth,
			verification.actorId,
			{
				organizationId: String(context.params.id),
				memberId: validation.data.memberId,
			},
		);
		return new Response(null, { status: 204 });
	} catch (error) {
		return domainProblem(error);
	}
};
