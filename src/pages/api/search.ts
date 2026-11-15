import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { problem } from "../../lib/api-adapters.ts";
import { loadSearchSlice } from "../../lib/search.ts";
import {
	parseQuery,
	rank,
	type SearchResponse,
} from "../../lib/search-query.ts";

export const prerender = false;

// The command palette's search. What it returns depends only on the signed-in
// user and `q`: an admin searches every client, anyone else (including an
// admin viewing as a client) the organizations they belong to. The middleware
// already sends /api with Cache-Control: no-store and X-Robots-Tag: noindex.
export const GET: APIRoute = async (context) => {
	const session = await context.locals.auth.api.getSession({
		headers: context.request.headers,
	});
	if (!session) return problem(401, "Unauthorized", "Sign in to search.");

	const query = (context.url.searchParams.get("q") ?? "").trim();
	if (query.length > 200) {
		return problem(400, "Bad Request", "Search for 200 characters or fewer.");
	}

	// Keyed by the acting person, so viewing as a client spends the admin's
	// budget, never the client's. The limiter guards the database and must not
	// take search down with it, so a failing limiter lets the request through.
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
		const { items, currencies } = await loadSearchSlice(
			context.locals.db,
			session,
			now,
		);
		const parsed = parseQuery(query, {
			admin: session.user.role === "admin",
			now,
			currencies,
		});
		return Response.json({
			query,
			filters: parsed.labels,
			groups: rank(items, parsed),
		} satisfies SearchResponse);
	} catch (error) {
		console.error("Search failed", error);
		return problem(500, "Internal Server Error", "Search failed.");
	}
};
