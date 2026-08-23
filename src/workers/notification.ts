import { createDb } from "../lib/database.ts";
import { resolveNotificationRecipients } from "../lib/notification-recipients.ts";
import { events } from "../lib/schema.ts";

export type SendNoticeResult =
	| { sent: true; messageId: string }
	| { sent: false; reason: string };

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

const skip = (phaseId: string, reason: string): SendNoticeResult => {
	console.log(
		JSON.stringify({
			event: "phase_approval_notice_skipped",
			workflowId: `phase-approval-${phaseId}`,
			phaseId,
			reason,
		}),
	);
	return { sent: false, reason };
};

export async function sendPhaseApprovalNotice(
	env: Env,
	phaseId: string,
): Promise<SendNoticeResult> {
	const db = createDb(env);

	const phase = await db.query.phases.findFirst({
		columns: {
			id: true,
			state: true,
			title: true,
			cost: true,
			currency: true,
			dueAt: true,
		},
		where: { id: phaseId },
		with: {
			project: {
				columns: { publicId: true, name: true, organizationId: true },
				with: {
					organization: {
						columns: { name: true, slug: true },
					},
				},
			},
		},
	});

	if (!phase?.project?.organization) {
		return skip(phaseId, "phase_missing");
	}

	if (phase.state !== "planned") {
		return skip(phaseId, "phase_no_longer_planned");
	}

	const { owners, admins } = await resolveNotificationRecipients(
		db,
		phase.project.organizationId,
	);

	if (owners.length === 0 && admins.length === 0) {
		return skip(phaseId, "no_eligible_recipients");
	}

	const message = buildPhaseEmail(
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

	const { messageId } = await env.MAIL.send({
		from: "craftlions <no-reply@craftlions.com>",
		to: message.to,
		...(message.cc.length > 0 ? { cc: message.cc } : {}),
		subject: message.subject,
		text: message.text,
	});

	return { sent: true, messageId };
}

export async function recordPhaseApprovalNoticeEvent(
	env: Env,
	phaseId: string,
) {
	const db = createDb(env);
	await db.insert(events).values({
		publicId: crypto.randomUUID(),
		aggregateType: "phase",
		aggregateId: phaseId,
		event: "approval_notice_sent",
		actorType: "system",
		actorId: "notification",
	});
}
