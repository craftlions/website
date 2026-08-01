import type { WorkflowEvent, WorkflowStep } from "cloudflare:workers";
import { WorkflowEntrypoint } from "cloudflare:workers";
import { sendNotification } from "./notification.ts";

type PhaseApprovalParams = {
	intentId: string;
	aggregateId: string;
	organizationId: string;
};

export class PhaseApprovalWorkflow extends WorkflowEntrypoint<
	Env,
	PhaseApprovalParams
> {
	override async run(
		event: WorkflowEvent<PhaseApprovalParams>,
		step: WorkflowStep,
	) {
		return step.do(
			"send initial phase approval notice",
			{
				retries: { limit: 5, delay: "10 seconds", backoff: "exponential" },
			},
			async () =>
				sendNotification(this.env, {
					id: event.payload.intentId,
					kind: "phase_approval",
					aggregateId: event.payload.aggregateId,
					organizationId: event.payload.organizationId,
					state: "dispatching",
				}),
		);
	}
}
