import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { serveFile } from "../../../../../lib/files.ts";

export const prerender = false;

export const GET: APIRoute = async (context) => {
	const session = context.locals.session;

	if (!session) {
		return context.redirect(
			`/login?returnTo=${encodeURIComponent(context.url.pathname)}`,
		);
	}

	const { slug, publicId } = context.params;
	const file =
		slug && publicId
			? await context.locals.db.query.files.findFirst({
					columns: { r2Key: true, filename: true, contentType: true },
					where: {
						publicId,
						organization: {
							slug,
							members: { userId: session.user.id },
						},
					},
				})
			: undefined;

	if (!file) {
		return new Response("Not found", { status: 404 });
	}

	return serveFile(env.DRIVE, file, context.request);
};
