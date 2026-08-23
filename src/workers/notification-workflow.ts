import type { WorkflowEvent, WorkflowStep } from "cloudflare:workers";
import { WorkflowEntrypoint } from "cloudflare:workers";
import {
	recordPhaseApprovalNoticeEvent,
	sendPhaseApprovalNotice,
} from "./notification.ts";

type NotificationParams = {
	kind: "phase_approval";
	aggregateId: string;
};

export class NotificationWorkflow extends WorkflowEntrypoint<
	Env,
	NotificationParams
> {
	override async run(
		event: WorkflowEvent<NotificationParams>,
		step: WorkflowStep,
	) {
		switch (event.payload.kind) {
			case "phase_approval":
				return this.phaseApproval(event.payload.aggregateId, step);
		}
	}

	async phaseApproval(phaseId: string, step: WorkflowStep) {
		const result = await step.do(
			"send initial phase approval notice",
			{
				retries: { limit: 5, delay: "10 seconds", backoff: "exponential" },
			},
			() => sendPhaseApprovalNotice(this.env, phaseId),
		);

		if (result.sent) {
			await step.do(
				"record approval notice event",
				{
					retries: { limit: 5, delay: "10 seconds", backoff: "exponential" },
				},
				() => recordPhaseApprovalNoticeEvent(this.env, phaseId),
			);
		}

		return result;
	}
}
