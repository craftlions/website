import type { APIRoute } from "astro";
import { z } from "astro/zod";
import { recordInvoice } from "../../../../../../lib/admin-mutations.ts";
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
			invoiceNumber: z.string().trim().min(1).max(80),
			stripeId: z.string().trim().min(1).max(140),
			stripePaymentPage: z.string().trim().url(),
			total: z.number().nonnegative(),
		})
		.safeParse(await context.request.json());

	if (!validation.success) {
		return problem(400, "Bad Request", z.prettifyError(validation.error));
	}

	try {
		const invoice = await recordInvoice(
			context.locals.db,
			verification.actorId,
			{
				phaseId: String(context.params.id),
				...validation.data,
			},
		);
		return new Response(JSON.stringify(invoice), {
			status: 201,
			headers: { "Content-Type": "application/json" },
		});
	} catch (error) {
		return domainProblem(error);
	}
};
