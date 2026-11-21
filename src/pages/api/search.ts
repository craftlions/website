import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { problem } from "../../lib/api-adapters.ts";
import { loadSearchHome, loadSearchSlice } from "../../lib/search.ts";
import { type SearchResponse, searchItems } from "../../lib/search-query.ts";

export const prerender = false;

export const GET: APIRoute = async (context) => {
	const session = await context.locals.auth.api.getSession({
		headers: context.request.headers,
	});
	if (!session) return problem(401, "Unauthorized", "Sign in to search.");

	const query = (context.url.searchParams.get("q") ?? "").trim();
	if (query.length > 200) {
		return problem(400, "Bad Request", "Search for 200 characters or fewer.");
	}

	try {
		const { success } = await env.SEARCH_RATE_LIMIT.limit({
			key: session.session.impersonatedBy ?? session.user.id,
		});
		if (!success) {
			const response = problem(
				429,
				"Too Many Requests",
				"Too many searches. Wait a few seconds.",
			);
			response.headers.set("Retry-After", "10");
			return response;
		}
	} catch (error) {
		console.error("Search rate limit failed", error);
	}

	try {
		const now = new Date();
		const { items, currencies } = query
			? await loadSearchSlice(context.locals.db, session, now)
			: await loadSearchHome(context.locals.db, session);
		return Response.json({
			query,
			...searchItems(items, query, {
				admin: session.user.role === "admin",
				now,
				currencies,
			}),
		} satisfies SearchResponse);
	} catch (error) {
		console.error("Search failed", error);
		return problem(500, "Internal Server Error", "Search failed.");
	}
};
