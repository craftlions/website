import { getActionContext } from "astro:actions";
import { defineMiddleware } from "astro:middleware";
import { env } from "cloudflare:workers";
import { createAuth } from "./lib/auth.ts";
import { createDb } from "./lib/database.ts";

const actionResultSessionKey = "action-result";

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

	const { action, serializeActionResult, setActionResult } =
		getActionContext(context);

	if (action?.calledFrom === "form" && context.session) {
		const actionResult = await action.handler();

		context.session.set(
			actionResultSessionKey,
			{
				actionName: action.name,
				actionResult: serializeActionResult(actionResult),
			},
			{ ttl: 60 },
		);

		let redirectPath = context.originPathname;

		if (actionResult.error) {
			const referer = context.request.headers.get("Referer");

			if (referer && URL.canParse(referer)) {
				const refererUrl = new URL(referer);

				if (refererUrl.origin === context.url.origin) {
					refererUrl.searchParams.delete("_action");
					redirectPath = `${refererUrl.pathname}${refererUrl.search}`;
				}
			}
		}

		const response = context.redirect(redirectPath, 303);
		response.headers.set("Cache-Control", "no-store");

		return response;
	}

	if (context.request.method === "GET" && context.session) {
		const actionResult = await context.session.get(actionResultSessionKey);

		if (actionResult) {
			setActionResult(actionResult.actionName, actionResult.actionResult);
			context.session.delete(actionResultSessionKey);
		}
	}

	const response = await next();

	if (isPersonalized) {
		response.headers.set("Cache-Control", "no-store");
	}

	return response;
});
