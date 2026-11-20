import type { APIContext, APIRoute } from "astro";
import { DomainError } from "./domain.ts";

export const problem = (status: number, title: string, detail: string) =>
	new Response(
		JSON.stringify({
			type: "about:blank",
			title,
			status,
			detail,
		}),
		{ status, headers: { "Content-Type": "application/problem+json" } },
	);

const statusForDomainError: Record<DomainError["code"], [number, string]> = {
	AlreadyExists: [409, "Conflict"],
	Conflict: [409, "Conflict"],
	Forbidden: [403, "Forbidden"],
	InvalidTransition: [409, "Conflict"],
	NotFound: [404, "Not Found"],
	Validation: [400, "Bad Request"],
};

// Runs an /api handler for the signed-in person: 401 without a session, 403
// for a request from another origin, a problem for a DomainError, and a
// logged 500 for anything else.
export const withSession =
	(
		label: string,
		handler: (
			context: APIContext,
			session: NonNullable<App.Locals["session"]>,
		) => Promise<Response>,
	): APIRoute =>
	async (context) => {
		const origin = context.request.headers.get("Origin");

		if (origin && origin !== context.url.origin) {
			return problem(403, "Forbidden", "Requests come from this site only.");
		}

		const session = await context.locals.auth.api.getSession({
			headers: context.request.headers,
		});

		if (!session) return problem(401, "Unauthorized", "Sign in first.");

		try {
			return await handler(context, session);
		} catch (error) {
			if (error instanceof DomainError) {
				const [status, title] = statusForDomainError[error.code];
				return problem(status, title, error.message);
			}

			console.error(`${label} failed`, error);
			return problem(500, "Internal Server Error", `${label} failed.`);
		}
	};
