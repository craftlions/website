import { env } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/node-postgres";
import { relations } from "./relations.ts";
import * as schema from "./schema.ts";

export const db = drizzle(env.HYPERDRIVE.connectionString, {
	relations: relations,
	schema: schema,
});
