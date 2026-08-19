import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import {
	domainProblem,
	verifyAdminApiKey,
} from "../../../../../../lib/api-adapters.ts";
import { refreshStripeInvoice } from "../../../../../../lib/stripe.ts";

export const prerender = false;

export const POST: APIRoute = async (context) => {
	const verification = await verifyAdminApiKey(context);
	if (verification.response) return verification.response;

	try {
		await refreshStripeInvoice(context.locals.db, {
			invoiceId: String(context.params.id),
			stripeKey: env.STRIPE_SECRET_KEY,
		});
		return new Response(null, { status: 204 });
	} catch (error) {
		return domainProblem(error);
	}
};
