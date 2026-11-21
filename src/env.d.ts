declare namespace App {
	interface Locals {
		db: import("./lib/database.ts").Db;
		auth: import("./lib/auth.ts").Auth;
		session?: Awaited<
			ReturnType<import("./lib/auth.ts").Auth["api"]["getSession"]>
		>;
		submittedInput?: [name: string, value: string][] | undefined;
	}

	interface SessionData {
		"form-action": {
			actionName: string;
			actionResult: ReturnType<
				ReturnType<
					typeof import("astro:actions").getActionContext
				>["serializeActionResult"]
			>;
			input?: [name: string, value: string][] | undefined;
		};
	}
}
