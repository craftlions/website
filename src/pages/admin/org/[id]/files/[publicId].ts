import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { serveFile } from "../../../../../lib/files.ts";

export const prerender = false;

export const GET: APIRoute = async (context) => {
	const { id, publicId } = context.params;
	const file =
		id && publicId
			? await context.locals.db.query.files.findFirst({
					columns: { r2Key: true, filename: true, contentType: true },
					where: { publicId, organizationId: id },
				})
			: undefined;

	if (!file) {
		return new Response("Not found", { status: 404 });
	}

	return serveFile(env.DRIVE, file, context.request);
};
