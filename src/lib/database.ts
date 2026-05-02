import { drizzle } from "drizzle-orm/node-postgres";
import { relations } from "./relations.ts";

export function createDb(env: Cloudflare.Env) {
	return drizzle(env.HYPERDRIVE.connectionString, {
		relations: relations,
	});
}

export type Db = ReturnType<typeof createDb>;
