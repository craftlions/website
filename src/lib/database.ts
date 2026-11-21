import { drizzle } from "drizzle-orm/postgres/cf";
import { relations } from "./relations.ts";

export function createDb(env: Cloudflare.Env) {
	return drizzle({
		connection: { url: env.HYPERDRIVE.connectionString, max: 5 },
		relations: relations,
	});
}

export type Db = ReturnType<typeof createDb>;
