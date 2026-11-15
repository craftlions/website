declare namespace App {
	interface Locals {
		db: import("./lib/database.ts").Db;
		auth: import("./lib/auth.ts").Auth;
		session?: Awaited<
			ReturnType<import("./lib/auth.ts").Auth["api"]["getSession"]>
		>;
		// The fields of a failed form action, from the session entry below; read
		// them with `submittedValues` (submitted-values.ts).
		submittedInput?: [name: string, value: string][] | undefined;
	}

	interface SessionData {
		// The last form action's result, stored by the middleware for the page
		// it redirects to.
		"form-action": {
			actionName: string;
			actionResult: ReturnType<
				ReturnType<
					typeof import("astro:actions").getActionContext
				>["serializeActionResult"]
			>;
			// Only stored for a failed action.
			input?: [name: string, value: string][] | undefined;
		};
	}
}
