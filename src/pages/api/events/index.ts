import type { APIRoute } from "astro";
import { event } from "../../../lib/schema.ts";

export const prerender = false;

export const GET: APIRoute = async (ctx) => {
	return new Response("List of events", { status: 200 });
};

export const POST: APIRoute = async (ctx) => {
	const result = await ctx.locals.auth.api.verifyApiKey({
		body: {
			key: ctx.request.headers.get("x-api-key") || "",
			// permissions: {
			// 	projects: ["read"],
			// },
		},
		headers: ctx.request.headers,
	});

	if (!result.valid) return new Response(result.error?.code, { status: 401 });
	if (!result.key?.metadata?.isAdmin)
		return new Response("API key does not have required permissions", {
			status: 403,
		});

	// VALIDATE BODY WITH ZOD

	// SERVICE LAYER LOGIC

	// API RESPONSE CLASS
	return new Response("Created", {
		status: 201,
		headers: { Location: `/api/events/:id` },
	});
};
