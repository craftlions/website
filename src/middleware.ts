import { defineMiddleware } from "astro:middleware";
import { env } from "cloudflare:workers";
import { createAuth } from "./lib/auth.ts";
import { createDb } from "./lib/database.ts";

export const onRequest = defineMiddleware(async (context, next) => {
	context.locals.db = createDb(env);
	context.locals.auth = createAuth(env);

	if (
		["/admin", "/dash", "/settings"].some(
			(path) =>
				context.url.pathname === path ||
				context.url.pathname.startsWith(`${path}/`),
		)
	) {
		context.locals.session = await context.locals.auth.api.getSession({
			headers: context.request.headers,
		});
	}

	if (
		context.url.pathname === "/admin" ||
		context.url.pathname.startsWith("/admin/")
	) {
		if (!context.locals.session) {
			return context.redirect("/login");
		}

		if (context.locals.session.user.role !== "admin") {
			return context.redirect("/dash");
		}
	}

	return next();
});
