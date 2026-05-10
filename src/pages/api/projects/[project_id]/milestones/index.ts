import type { APIRoute } from "astro";
import { z } from "astro/zod";
import { event } from "../../../../../lib/schema";

export const prerender = false;

export const POST = (async ({ request, locals, params }) => {
	const result = await locals.auth.api.verifyApiKey({
		body: {
			key: request.headers.get("x-api-key") || "",
		},
		headers: request.headers,
	});

	if (!result.valid || !result.key) {
		return new Response(
			JSON.stringify({
				type: "about:blank",
				title: "Unauthorized",
				status: 401,
				detail: "Invalid API key",
			}),
			{ status: 401, headers: { "Content-Type": "application/problem+json" } },
		);
	}

	if (!result.key.metadata?.isAdmin) {
		return new Response(
			JSON.stringify({
				type: "about:blank",
				title: "Forbidden",
				status: 403,
				detail: "API key does not have required permissions",
			}),
			{ status: 403, headers: { "Content-Type": "application/problem+json" } },
		);
	}

	try {
		const project = await locals.db.query.project.findFirst({
			columns: { id: true },
			where: {
				id: String(params.project_id),
			},
		});
		if (!project) {
			return new Response(
				JSON.stringify({
					type: "about:blank",
					title: "Not Found",
					status: 404,
					detail: "Project not found",
				}),
				{
					status: 404,
					headers: { "Content-Type": "application/problem+json" },
				},
			);
		}
	} catch (error) {
		return new Response(
			JSON.stringify({
				type: "about:blank",
				title: "Internal Server Error",
				status: 500,
				detail: "An error occurred while fetching the project",
			}),
			{ status: 500, headers: { "Content-Type": "application/problem+json" } },
		);
	}

	if (request.headers.get("Content-Type") !== "application/json") {
		return new Response(
			JSON.stringify({
				type: "about:blank",
				title: "Unsupported Media Type",
				status: 415,
				detail: "Content-Type must be application/json",
			}),
			{ status: 415, headers: { "Content-Type": "application/problem+json" } },
		);
	}

	const body = await request.json();
	const validation = await z
		.strictObject({
			title: z.string(),
			cost: z.number().nonnegative(),
			currency: z.literal(["EUR"]),
			state: z.literal([
				"submitted",
				"planned",
				"approved",
				"in_progress",
				"invoiced",
				"paid",
				"cancelled",
			]),
			dueAt: z.coerce.date(),
		})
		.safeParseAsync(body);

	if (!validation.success) {
		return new Response(
			JSON.stringify({
				type: "about:blank",
				title: "Bad Request",
				status: 400,
				detail: z.prettifyError(validation.error),
			}),
			{ status: 400, headers: { "Content-Type": "application/problem+json" } },
		);
	}

	try {
		const row = await locals.db
			.insert(event)
			.values({
				aggregateType: "milestone",
				aggregateId: crypto.randomUUID(),
				eventType: "created",
				version: 1,
				payload: {
					type: "milestone",
					changes: {
						title: { to: validation.data.title },
						cost: { to: validation.data.cost },
						currency: { to: validation.data.currency },
						state: { to: validation.data.state },
						due_at: { to: validation.data.dueAt.toISOString() },
						project_id: { to: params.project_id },
					},
				},
				actorType: "user",
				actorId: result.key.referenceId,
				recordedAt: new Date(),
			})
			.returning();

		if (!row[0]) {
			return new Response(
				JSON.stringify({
					type: "about:blank",
					title: "Internal Server Error",
					status: 500,
					detail: "Failed to create milestone",
				}),
				{
					status: 500,
					headers: { "Content-Type": "application/problem+json" },
				},
			);
		}

		return new Response("Created", {
			status: 201,
			headers: {
				Location: `/api/projects/${params.project_id}/milestones/${row[0].aggregateId}`,
			},
		});
	} catch (error) {
		return new Response(
			JSON.stringify({
				type: "about:blank",
				title: "Internal Server Error",
				status: 500,
				detail: "An error occurred while creating the milestone",
			}),
			{ status: 500, headers: { "Content-Type": "application/problem+json" } },
		);
	}
}) satisfies APIRoute;
