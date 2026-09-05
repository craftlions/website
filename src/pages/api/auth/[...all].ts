import type { APIRoute } from "astro";

export const prerender = false;

export const ALL: APIRoute = (ctx) => ctx.locals.auth.handler(ctx.request);
