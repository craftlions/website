import { defineMiddleware } from "astro:middleware";
import { env } from "cloudflare:workers";
import { createAuth } from "./lib/auth.ts";
import { createDb } from "./lib/database.ts";

export const onRequest = defineMiddleware(async (context, next) => {
	context.locals.db = createDb(env);
	context.locals.auth = createAuth(env);

	const pathname = context.url.pathname;
	const matches = (path: string) =>
		pathname === path || pathname.startsWith(`${path}/`);

	const needsSession = ["/admin", "/dash", "/settings"].some(matches);
	const isPersonalized = needsSession || matches("/api");

	if (needsSession) {
		context.locals.session = await context.locals.auth.api.getSession({
			headers: context.request.headers,
		});
	}

	if (matches("/admin")) {
		if (!context.locals.session) {
			return context.redirect("/login");
		}

		if (context.locals.session.user.role !== "admin") {
			return context.redirect("/dash");
		}
	}

	const response = await next();

	if (isPersonalized) {
		response.headers.set("Cache-Control", "no-store");
	}

	return response;
});
