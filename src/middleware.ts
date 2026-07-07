import { defineMiddleware } from "astro:middleware";
import { env } from "cloudflare:workers";
import { createAuth } from "./lib/auth.ts";
import { createDb } from "./lib/database.ts";

export const onRequest = defineMiddleware(async (context, next) => {
	context.locals.db = createDb(env);
	context.locals.auth = createAuth(env);

	if (
		context.url.pathname === "/admin" ||
		context.url.pathname.startsWith("/admin/")
	) {
		const session = await context.locals.auth.api.getSession({
			headers: context.request.headers,
		});

		if (!session) {
			return context.redirect("/login");
		}

		if (session.user.role !== "admin") {
			return context.redirect("/dash");
		}
	}

	return next();
});
