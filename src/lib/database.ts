import { drizzle } from "drizzle-orm/postgres/cf";
import { relations } from "./relations.ts";

export function createDb(env: Cloudflare.Env) {
	return drizzle({
		// Workers allow six concurrent outbound sockets; one shared pool of five
		// leaves headroom for fetch() while page reads run in parallel.
		connection: { url: env.HYPERDRIVE.connectionString, max: 5 },
		relations: relations,
	});
}

export type Db = ReturnType<typeof createDb>;
