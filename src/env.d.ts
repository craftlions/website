declare namespace App {
	interface Locals {
		db: import("./lib/database.ts").Db;
		auth: import("./lib/auth.ts").Auth;
	}
}
