import { env } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";
import { relations } from "./relations.ts";
import * as schema from "./schema.ts";

export const db = drizzle(env.DB, { relations: relations, schema: schema });
