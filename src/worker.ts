import handler from "@astrojs/cloudflare/entrypoints/server";

export { NotificationWorkflow } from "./workers/notification-workflow.ts";

export default {
	async fetch(request, env, ctx) {
		return handler.fetch(request, env, ctx);
	},
} satisfies ExportedHandler<Env>;
