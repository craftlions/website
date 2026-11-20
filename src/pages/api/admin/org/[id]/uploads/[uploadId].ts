import { env } from "cloudflare:workers";
import { z } from "astro/zod";
import { problem, withSession } from "../../../../../../lib/api-adapters.ts";
import {
	abortUpload,
	completeUpload,
	uploadPart,
} from "../../../../../../lib/file-mutations.ts";

export const prerender = false;

// One multipart upload, named by its key (`?key=`) and upload id:
// PUT a part (`&part=N`, the bytes as the body), POST to complete it, DELETE
// to abort it. Admin only.

export const PUT = withSession("Upload", async (context, session) => {
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
				partNumber: z.number().int().min(1).max(10000),
				etag: z.string().min(1),
			}),
		)
		.min(1)
		.max(10000),
});

export const POST = withSession("Upload", async (context, session) => {
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

export const DELETE = withSession("Upload", async (context, session) => {
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
