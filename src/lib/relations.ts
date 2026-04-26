import { defineRelations } from "drizzle-orm";
import * as schema from "./schema.ts";

export const relations = defineRelations(schema, (r) => ({
	account: {
		user: r.one.user({
			from: r.account.userId,
			to: r.user.id,
		}),
	},
	organization: {
		metadata: r.one.organizationMetadata({
			from: r.organization.id,
			to: r.organizationMetadata.organizationId,
		}),
		projects: r.many.project({
			from: r.organization.id,
			to: r.project.organizationId,
		}),
	},
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
}));
