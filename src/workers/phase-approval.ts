import type { WorkflowEvent, WorkflowStep } from "cloudflare:workers";
import { WorkflowEntrypoint } from "cloudflare:workers";
import {
	recordPhaseApprovalNoticeEvent,
	sendPhaseApprovalNotice,
} from "./notification.ts";

type PhaseApprovalParams = {
	phaseId: string;
};

export class PhaseApprovalWorkflow extends WorkflowEntrypoint<
	Env,
	PhaseApprovalParams
> {
	override async run(
		event: WorkflowEvent<PhaseApprovalParams>,
		step: WorkflowStep,
	) {
		const result = await step.do(
			"send initial phase approval notice",
			{
				retries: { limit: 5, delay: "10 seconds", backoff: "exponential" },
			},
			() => sendPhaseApprovalNotice(this.env, event.payload.phaseId),
		);

		if (result.sent) {
			await step.do(
				"record approval notice event",
				{
					retries: { limit: 5, delay: "10 seconds", backoff: "exponential" },
				},
				() => recordPhaseApprovalNoticeEvent(this.env, event.payload.phaseId),
			);
		}

		return result;
	}
}
