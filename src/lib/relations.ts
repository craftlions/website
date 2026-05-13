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
		projects: r.many.projects({
			from: r.organization.id,
			to: r.projects.organizationId,
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
	projects: {
		organization: r.one.organization({
			from: r.projects.organizationId,
			to: r.organization.id,
		}),
		invoices: r.many.invoices({
			from: r.projects.id,
			to: r.invoices.projectId,
		}),
		phases: r.many.phases({
			from: r.projects.id,
			to: r.phases.projectId,
		}),
		events: r.many.events({
			from: r.projects.id,
			to: r.events.aggregateId,
			where: {
				aggregateType: "project",
			},
		}),
	},
	phases: {
		project: r.one.projects({
			from: r.phases.projectId,
			to: r.projects.id,
		}),
		events: r.many.events({
			from: r.phases.id,
			to: r.events.aggregateId,
			where: {
				aggregateType: "milestone",
			},
		}),
	},
	invoices: {
		project: r.one.projects({
			from: r.invoices.projectId,
			to: r.projects.id,
		}),
		events: r.many.events({
			from: r.invoices.id,
			to: r.events.aggregateId,
			where: {
				aggregateType: "invoice",
			},
		}),
	},
}));
