import type { APIRoute } from "astro";
import { z } from "astro/zod";
import { events, phases } from "../../../../../lib/schema";

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

	const apiKey = result.key;

	if (!apiKey.referenceId || !apiKey.metadata?.isAdmin) {
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
		const project = await locals.db.query.projects.findFirst({
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
	} catch {
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
			currency: z.enum(["EUR"]),
			state: z.enum([
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
		const row = await locals.db.transaction(async (tx) => {
			const phaseRows = await tx
				.insert(phases)
				.values({
					publicId: crypto.randomUUID(),
					projectId: String(params.project_id),
					title: validation.data.title,
					cost: validation.data.cost,
					currency: validation.data.currency,
					state: validation.data.state,
					dueAt: validation.data.dueAt,
				})
				.returning({ id: phases.id });

			if (!phaseRows[0]?.id) {
				return null;
			}

			await tx.insert(events).values({
				publicId: crypto.randomUUID(),
				aggregateType: "milestone",
				aggregateId: phaseRows[0].id,
				event: "created",
				actorType: "user",
				actorId: apiKey.referenceId,
			});

			return phaseRows[0];
		});

		if (!row) {
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
				Location: `/api/projects/${params.project_id}/phases/${row.id}`,
			},
		});
	} catch {
		return new Response(
			JSON.stringify({
				type: "about:blank",
				title: "Internal Server Error",
				status: 500,
				detail: "An error occurred while creating the phase",
			}),
			{ status: 500, headers: { "Content-Type": "application/problem+json" } },
		);
	}
}) satisfies APIRoute;
