import { defineRelations } from "drizzle-orm";
import * as schema from "./schema.ts";

export const relations = defineRelations(schema, (r) => ({
	// BETTER-AUTH
	account: {
		user: r.one.user({
			from: r.account.userId,
			to: r.user.id,
		}),
	},
	organization: {
		data: r.one.organizationMetadata({
			from: r.organization.id,
			to: r.organizationMetadata.organizationId,
		}),
		projects: r.many.project({
			from: r.organization.id,
			to: r.project.organizationId,
		}),
	},
		session: {
		user: r.one.user({
			from: r.session.userId,
			to: r.user.id,
		}),
	},
	user: {
		accounts: r.many.account({
			from: r.user.id,
			to: r.account.userId,
		}),
		sessions: r.many.session({
			from: r.user.id,
			to: r.session.userId,
		}),
	},
	// CUSTOM
	organizationMetadata: {
		organization: r.one.organization({
			from: r.organizationMetadata.organizationId,
			to: r.organization.id,
		}),
	},
	project: {
		organization: r.one.organization({
			from: r.project.organizationId,
			to: r.organization.id,
		}),
		invoices: r.many.invoice({
			from: r.project.id,
			to: r.invoice.projectId,
		}),
		milestones: r.many.milestone({
			from: r.project.id,
			to: r.milestone.projectId,
		}),
		events: r.many.event({
			from: r.project.id,
			to: r.event.aggregateId,
			where: {
				aggregateType: "project",
			}
		})
	},
	milestone: {
		events: r.many.event({
			from: r.milestone.id,
			to: r.event.aggregateId,
			where: {
				aggregateType: "milestone",
			}
		})
	},
}));
