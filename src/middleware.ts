import { defineMiddleware } from "astro:middleware";
import { env } from "cloudflare:workers";
import { createAuth } from "./lib/auth.ts";
import { createDb } from "./lib/database.ts";

export const onRequest = defineMiddleware((context, next) => {
	context.locals.db = createDb(env);
	context.locals.auth = createAuth(env);
	return next();
});
