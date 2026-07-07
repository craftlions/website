import type { APIContext } from "astro";
import { DomainError } from "./admin-mutations.ts";

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

export const verifyAdminApiKey = async (context: APIContext) => {
	const result = await context.locals.auth.api.verifyApiKey({
		body: {
			key: context.request.headers.get("x-api-key") || "",
		},
		headers: context.request.headers,
	});

	if (!result.valid || !result.key) {
		return { response: problem(401, "Unauthorized", "Invalid API key") };
	}

	if (!result.key.referenceId || !result.key.metadata?.isAdmin) {
		return {
			response: problem(
				403,
				"Forbidden",
				"API key does not have required permissions",
			),
		};
	}

	return { actorId: result.key.referenceId };
};

export const domainProblem = (error: unknown) => {
	if (error instanceof DomainError) {
		switch (error.code) {
			case "Forbidden":
				return problem(403, "Forbidden", error.message);
			case "NotFound":
				return problem(404, "Not Found", error.message);
			case "AlreadyExists":
			case "InvalidTransition":
			case "Validation":
				return problem(400, "Bad Request", error.message);
			case "StripeUnavailable":
				return problem(503, "Service Unavailable", error.message);
		}
	}

	return problem(500, "Internal Server Error", "An unexpected error occurred");
};

export const requireJson = (request: Request) =>
	request.headers.get("Content-Type")?.includes("application/json")
		? null
		: problem(
				415,
				"Unsupported Media Type",
				"Content-Type must be application/json",
			);
