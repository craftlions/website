import { getActionContext } from "astro:actions";
import { defineMiddleware } from "astro:middleware";
import { env } from "cloudflare:workers";
import { nextPath } from "./lib/action-feedback.ts";
import { createAuth } from "./lib/auth.ts";
import { createDb } from "./lib/database.ts";
import { submittedEntries } from "./lib/submitted-values.ts";

// One session entry holds the last form action's result and, when it failed,
// the submitted values (see submitted-values.ts).
const actionResultSessionKey = "form-action";

export const onRequest = defineMiddleware(async (context, next) => {
	context.locals.db = createDb(env);
	context.locals.auth = createAuth(env, context.locals.db);

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

	// Form actions follow post/redirect/get: the result is stored in the
	// session and the browser is sent to a page that shows it.
	// - Success goes to the `next` path the action's data names, when it is a
	//   same-origin path (see `nextPath`), else back to the posting page.
	// - Failure goes back to the referring page, so the form is there again,
	//   and the entry also keeps the submitted text fields so the page can
	//   fill the form in again (`submittedValues`, `Field`).
	// - The stored result survives redirects: the GET branch below hands it to
	//   every request but deletes it only once a page answers with something
	//   other than a redirect. A page that redirects first (a deleted client's
	//   settings page sending the admin to /admin) passes it on, and the page
	//   that renders shows it.
	if (action?.calledFrom === "form" && context.session) {
		// The handler reads the body, so the submitted values come from a copy.
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
			context.originPathname;

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

	const storedResult =
		context.request.method === "GET" && context.session
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

	if (isPersonalized) {
		response.headers.set("Cache-Control", "no-store");
	}

	return response;
});
