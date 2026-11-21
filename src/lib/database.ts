import { drizzle } from "drizzle-orm/postgres/cf";
import { relations } from "./relations.ts";

export function createDb(env: Cloudflare.Env) {
	return drizzle({
		connection: env.HYPERDRIVE.connectionString,
		relations: relations,
	});
}

export type Db = ReturnType<typeof createDb>;
