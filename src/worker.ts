import { env } from "cloudflare:workers";
import handler from "@astrojs/cloudflare/entrypoints/server";
import { eq } from "drizzle-orm";
import { createDb } from "./lib/database.ts";
import { notificationIntent } from "./lib/schema.ts";

export { PhaseApprovalWorkflow } from "./workers/phase-approval.ts";

export default {
	async fetch(request, _env, ctx) {
		return handler.fetch(request, _env, ctx);
	},

	async scheduled(_controller, _env, _ctx) {
		await reconcilePendingIntents();
	},
} satisfies ExportedHandler<Env>;

async function reconcilePendingIntents() {
	const db = createDb(env);

	const pending = await db
		.select({
			id: notificationIntent.id,
			kind: notificationIntent.kind,
			aggregateId: notificationIntent.aggregateId,
			organizationId: notificationIntent.organizationId,
			state: notificationIntent.state,
		})
		.from(notificationIntent)
		.where(eq(notificationIntent.state, "pending"))
		.limit(100);

	for (const intent of pending) {
		if (intent.kind !== "phase_approval") continue;

		try {
			const workflowId = `phase-approval-${intent.id}`;
			await env.PHASE_APPROVAL_WORKFLOW.create({
				id: workflowId,
				params: {
					intentId: intent.id,
					aggregateId: intent.aggregateId,
					organizationId: intent.organizationId,
				},
			});
			await db
				.update(notificationIntent)
				.set({ state: "dispatched", workflowId, dispatchedAt: new Date() })
				.where(eq(notificationIntent.id, intent.id));
		} catch (error) {
			console.error(
				JSON.stringify({
					event: "reconcile_failed",
					intentId: intent.id,
					workflowId: `phase-approval-${intent.id}`,
					notificationKind: intent.kind,
					stage: "initial_notice",
					aggregateId: intent.aggregateId,
					error: error instanceof Error ? error.message : String(error),
				}),
			);
		}
	}
}
