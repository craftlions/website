import type { APIRoute } from "astro";

export const prerender = false;

export const GET: APIRoute = async (ctx) => {
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

	const projects = await ctx.locals.db.query.project.findMany();

	return new Response(JSON.stringify(projects), {
		headers: {
			"Content-Type": "application/json",
		},
	});
};
