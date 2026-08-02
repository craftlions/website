import handler from "@astrojs/cloudflare/entrypoints/server";

export { PhaseApprovalWorkflow } from "./workers/phase-approval.ts";

export default {
	async fetch(request, env, ctx) {
		return handler.fetch(request, env, ctx);
	},
} satisfies ExportedHandler<Env>;
