import { env } from "cloudflare:workers";
import { z } from "astro/zod";
import {
	problem,
	withAdminSession,
} from "../../../../../../lib/api-adapters.ts";
import {
	abortUpload,
	completeUpload,
	uploadPart,
} from "../../../../../../lib/file-mutations.ts";
import { maxParts } from "../../../../../../lib/files.ts";

export const prerender = false;

export const PUT = withAdminSession("Upload", async (context, session) => {
	const key = context.url.searchParams.get("key");
	const { id, uploadId } = context.params;

	if (!key || !id || !uploadId || !context.request.body) {
		return problem(400, "Bad Request", "Send the key, part number and bytes.");
	}

	return Response.json(
		await uploadPart(context.locals.db, env.DRIVE, session.user.id, {
			organizationId: id,
			key,
			uploadId,
			partNumber: Number(context.url.searchParams.get("part")),
			size: Number(context.request.headers.get("Content-Length") ?? Number.NaN),
			body: context.request.body,
		}),
	);
});

const completeSchema = z.object({
	key: z.string().min(1),
	filename: z.string().min(1).max(1024),
	contentType: z.string().max(255),
	replace: z.boolean(),
	parts: z
		.array(
			z.object({
				partNumber: z.number().int().min(1).max(maxParts),
				etag: z.string().min(1),
			}),
		)
		.min(1)
		.max(maxParts),
});

export const POST = withAdminSession("Upload", async (context, session) => {
	const input = completeSchema.safeParse(
		await context.request.json().catch(() => null),
	);
	const { id, uploadId } = context.params;

	if (!input.success || !id || !uploadId) {
		return problem(400, "Bad Request", "Send the key, parts and file details.");
	}

	return Response.json(
		await completeUpload(context.locals.db, env.DRIVE, session.user.id, {
			organizationId: id,
			uploadId,
			...input.data,
		}),
	);
});

export const DELETE = withAdminSession("Upload", async (context, session) => {
	const key = context.url.searchParams.get("key");
	const { id, uploadId } = context.params;

	if (!key || !id || !uploadId) {
		return problem(400, "Bad Request", "Send the key.");
	}

	await abortUpload(context.locals.db, env.DRIVE, session.user.id, {
		organizationId: id,
		key,
		uploadId,
	});

	return new Response(null, { status: 204 });
});
