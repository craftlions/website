import type { Db } from "../lib/database.ts";
import { eq, sql } from "drizzle-orm";
import { createDb } from "../lib/database.ts";
import { resolveNotificationRecipients } from "../lib/notification-recipients.ts";
import { notificationIntent, notificationStageResult } from "../lib/schema.ts";

export interface NotificationIntent {
	id: string;
	kind: "phase_approval";
	aggregateId: string;
	organizationId: string;
	state: string | null;
}

export interface SendNotificationResult {
	skipped: boolean;
	reason?: string;
	sent?: boolean;
	messageId?: string;
}

const formatCost = (cost: string | number | null, currency: string): string => {
	if (cost == null) return "—";
	const amount = typeof cost === "string" ? parseFloat(cost) : cost;
	return new Intl.NumberFormat("de-DE", {
		style: "currency",
		currency: currency,
	}).format(amount);
};

const buildPhaseEmail = (
	phase: {
		title: string;
		cost: string | number | null;
		currency: string;
		dueAt: Date | null;
		project: {
			name: string;
			organization: { name: string; slug: string };
			publicId: string;
		};
	},
	to: string[],
	cc: string[],
) => {
	const formattedCost = formatCost(phase.cost, phase.currency);
	const formattedDue = phase.dueAt
		? new Date(phase.dueAt).toLocaleDateString("de-DE", {
				year: "numeric",
				month: "2-digit",
				day: "2-digit",
				hour: "2-digit",
				minute: "2-digit",
				timeZone: "Europe/Berlin",
			})
		: "Not scheduled";

	const projectPublicId = phase.project.publicId;
	const portalLink = `https://craftlions.com/dash/org/${phase.project.organization.slug}/project/${projectPublicId}#phases`;

	const subject = `Approval required: ${phase.project.name} — ${phase.title}`;

	const body = [
		"Hi,",
		"",
		`The phase "${phase.title}" for ${phase.project.name} (${phase.project.organization.name}) is ready for your review.`,
		"",
		"Details:",
		`- Cost: ${formattedCost}`,
		`- Due date: ${formattedDue}`,
		"",
		"Please review and approve or decline this phase in the portal:",
		portalLink,
		"",
		"This is an automated message from craftlions.",
	].join("\n");

	return { to, cc, subject, text: body };
};

async function recordStageResult(
	db: Db,
	intentId: string,
	state: "sent" | "skipped" | "errored",
	options: {
		reason?: string;
		messageId?: string;
		error?: string;
	} = {},
) {
	const now = new Date();
	await db
		.insert(notificationStageResult)
		.values({
			intentId,
			stage: "initial_notice",
			state,
			sentMessageId: options.messageId ?? null,
			sentAt: options.messageId ? now : null,
			skippedReason: options.reason ?? null,
			failures: options.error ? 1 : 0,
			lastError: options.error ?? null,
			createdAt: now,
			updatedAt: now,
		})
		.onConflictDoUpdate({
			target: [notificationStageResult.intentId, notificationStageResult.stage],
			set: {
				state,
				sentMessageId: options.messageId ?? null,
				sentAt: options.messageId ? now : null,
				skippedReason: options.reason ?? null,
				failures: options.error
					? sql`${notificationStageResult.failures} + 1`
					: notificationStageResult.failures,
				lastError: options.error ?? null,
				updatedAt: now,
			},
		});
}

async function sendMail(
	env: Env,
	options: {
		from: string;
		to: string[];
		cc?: string[];
		subject: string;
		text: string;
	},
): Promise<string> {
	const response = await env.MAIL.send({
		from: options.from,
		to: options.to,
		...(options.cc ? { cc: options.cc } : {}),
		subject: options.subject,
		text: options.text,
	});

	return response.messageId;
}

export async function sendNotification(
	env: Env,
	intent: NotificationIntent,
): Promise<SendNotificationResult> {
	const db = createDb(env);

	const phase = await db.query.phases.findFirst({
		columns: {
			id: true,
			publicId: true,
			state: true,
			title: true,
			cost: true,
			currency: true,
			dueAt: true,
			projectId: true,
		},
		where: { id: intent.aggregateId },
		with: {
			project: {
				columns: {
					id: true,
					publicId: true,
					name: true,
					organizationId: true,
				},
				with: {
					organization: {
						columns: { name: true, slug: true },
					},
				},
			},
		},
	});

	if (!phase?.project?.organization) {
		await recordStageResult(db, intent.id, "skipped", {
			reason: "phase_missing",
		});
		return { skipped: true, reason: "phase_missing" };
	}

	if (phase.state !== "planned") {
		await recordStageResult(db, intent.id, "skipped", {
			reason: "phase_no_longer_planned",
		});
		return { skipped: true, reason: "phase_no_longer_planned" };
	}

	const existing = await db.query.notificationStageResult.findFirst({
		columns: { id: true, state: true, sentMessageId: true },
		where: { intentId: intent.id, stage: "initial_notice" },
	});

	if (existing?.state === "sent" && existing.sentMessageId) {
		return {
			skipped: true,
			reason: "already_sent",
			messageId: existing.sentMessageId,
		};
	}

	const { owners, admins } = await resolveNotificationRecipients(
		db,
		intent.organizationId,
	);

	if (owners.length === 0 && admins.length === 0) {
		await recordStageResult(db, intent.id, "skipped", {
			reason: "no_eligible_recipients",
		});
		return { skipped: true, reason: "no_eligible_recipients" };
	}

	const emailOptions = buildPhaseEmail(
		{
			title: phase.title,
			cost: phase.cost,
			currency: phase.currency,
			dueAt: phase.dueAt,
			project: {
				name: phase.project.name,
				organization: {
					name: phase.project.organization.name,
					slug: phase.project.organization.slug,
				},
				publicId: phase.project.publicId,
			},
		},
		owners.map((o) => o.email),
		admins.map((a) => a.email),
	);

	const to = emailOptions.to;
	try {
		const messageId = await sendMail(env, {
			from: "craftlions <no-reply@craftlions.com>",
			to,
			...(emailOptions.cc.length > 0 ? { cc: emailOptions.cc } : {}),
			subject: emailOptions.subject,
			text: emailOptions.text,
		});

		await recordStageResult(db, intent.id, "sent", { messageId });
		await db
			.update(notificationIntent)
			.set({ state: "dispatched", dispatchedAt: new Date() })
			.where(eq(notificationIntent.id, intent.id));

		return { skipped: false, sent: true, messageId };
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		await recordStageResult(db, intent.id, "errored", { error: message });
		console.error(
			JSON.stringify({
				event: "notification_workflow_failed",
				intentId: intent.id,
				workflowId: `phase-approval-${intent.id}`,
				notificationKind: intent.kind,
				stage: "initial_notice",
				aggregateId: intent.aggregateId,
				error: message,
			}),
		);
		throw error;
	}
}
