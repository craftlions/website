import { getActionContext } from "astro:actions";
import { defineMiddleware } from "astro:middleware";
import { env } from "cloudflare:workers";
import { nextPath, sameOriginPath } from "./lib/action-feedback.ts";
import { createAuth } from "./lib/auth.ts";
import { createDb } from "./lib/database.ts";
import { isPrivatePath } from "./lib/indexing.ts";
import { submittedEntries } from "./lib/submitted-values.ts";

const actionResultSessionKey = "form-action";

export const onRequest = defineMiddleware(async (context, next) => {
	context.locals.db = createDb(env);
	context.locals.auth = createAuth(env, context.locals.db);

	const pathname = context.url.pathname;
	const matches = (path: string) =>
		pathname === path || pathname.startsWith(`${path}/`);

	const needsSession = ["/admin", "/dash", "/settings"].some(matches);
	const isPersonalized = needsSession || matches("/api");
	const withHeaders = (response: Response) => {
		if (isPersonalized) {
			response.headers.set("Cache-Control", "no-store");
		}

		if (isPrivatePath(pathname)) {
			response.headers.set("X-Robots-Tag", "noindex");
		}

		return response;
	};

	if (needsSession) {
		context.locals.session = await context.locals.auth.api.getSession({
			headers: context.request.headers,
		});
	}

	if (matches("/admin")) {
		if (!context.locals.session) {
			return withHeaders(context.redirect("/login"));
		}

		if (context.locals.session.user.role !== "admin") {
			return withHeaders(context.redirect("/dash"));
		}
	}

	const { action, serializeActionResult, setActionResult } =
		getActionContext(context);

	if (action?.calledFrom === "form" && context.session) {
		const submission = context.request.clone();
		const actionResult = await action.handler();

		context.session.set(
			actionResultSessionKey,
			{
				actionName: action.name,
				actionResult: serializeActionResult(actionResult),
				input: actionResult.error
					? await submittedEntries(submission)
					: undefined,
			},
			{ ttl: 60 },
		);

		let redirectPath =
			(!actionResult.error && nextPath(actionResult.data, context.url)) ||
			sameOriginPath(context.originPathname, context.url) ||
			"/";

		if (actionResult.error) {
			const referer = context.request.headers.get("Referer");

			if (referer && URL.canParse(referer)) {
				const refererUrl = new URL(referer);

				if (refererUrl.origin === context.url.origin) {
					refererUrl.searchParams.delete("_action");
					redirectPath =
						sameOriginPath(
							`${refererUrl.pathname}${refererUrl.search}`,
							context.url,
						) ?? redirectPath;
				}
			}
		}

		const response = context.redirect(redirectPath, 303);
		response.headers.set("Cache-Control", "no-store");

		return response;
	}

	const storedResult =
		context.request.method === "GET" && context.session && !matches("/api")
			? await context.session.get(actionResultSessionKey)
			: undefined;

	if (storedResult) {
		setActionResult(storedResult.actionName, storedResult.actionResult);
		context.locals.submittedInput = storedResult.input;
	}

	const response = await next();

	if (storedResult && !(response.status >= 300 && response.status < 400)) {
		context.session?.delete(actionResultSessionKey);
	}

	return withHeaders(response);
});
