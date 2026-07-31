declare namespace App {
	interface Locals {
		db: import("./lib/database.ts").Db;
		auth: import("./lib/auth.ts").Auth;
		session?: Awaited<
			ReturnType<import("./lib/auth.ts").Auth["api"]["getSession"]>
		>;
	}
}
