import { drizzle } from "drizzle-orm/node-postgres";
import { relations } from "./relations.ts";
import * as schema from "./schema.ts";

export function createDb(env: Cloudflare.Env) {
	return drizzle(env.HYPERDRIVE.connectionString, {
		relations,
		schema,
	});
}

export type Db = ReturnType<typeof createDb>;
