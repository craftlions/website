import { env } from "cloudflare:workers";
import { z } from "astro/zod";
import { problem, withAdminSession } from "../../../../../lib/api-adapters.ts";
import { startUpload } from "../../../../../lib/file-mutations.ts";

export const prerender = false;

const startSchema = z.object({
	filename: z.string().min(1).max(1024),
	contentType: z.string().max(255),
});

// Starts a multipart upload into this client's drive; the browser then sends
// the parts to ./uploads/[uploadId]. Admin only: anyone else gets 403
// before the body is read.
export const POST = withAdminSession("Upload", async (context, session) => {
	const input = startSchema.safeParse(
		await context.request.json().catch(() => null),
	);

	if (!input.success || !context.params.id) {
		return problem(400, "Bad Request", "Send a filename and content type.");
	}

	return Response.json(
		await startUpload(context.locals.db, env.DRIVE, session.user.id, {
			organizationId: context.params.id,
			...input.data,
		}),
	);
});
