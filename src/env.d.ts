declare namespace App {
	interface Locals {
		db: import("./lib/database.ts").Db;
		auth: import("./lib/auth.ts").Auth;
		session?: Awaited<
			ReturnType<import("./lib/auth.ts").Auth["api"]["getSession"]>
		>;
	}

	interface SessionData {
		"action-result": {
			actionName: string;
			actionResult: ReturnType<
				ReturnType<
					typeof import("astro:actions").getActionContext
				>["serializeActionResult"]
			>;
		};
	}
}
