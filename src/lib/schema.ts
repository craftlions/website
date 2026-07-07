import { sql } from "drizzle-orm";
import * as t from "drizzle-orm/pg-core";
import { createInsertSchema, createUpdateSchema } from "drizzle-orm/zod";

/**
 * BETTER-AUTH TABLES
 */

export const user = t.pgTable("user", {
	id: t.text("id").primaryKey(),
	name: t.text("name").notNull(),
	email: t.varchar("email").notNull().unique(),
	emailVerified: t.boolean("email_verified").default(false).notNull(),
	image: t.text("image"),
	createdAt: t
		.timestamp("created_at", { withTimezone: true })
		.defaultNow()
		.notNull(),
	updatedAt: t
		.timestamp("updated_at", { withTimezone: true })
		.defaultNow()
		.$onUpdate(() => new Date())
		.notNull(),
	lastActiveAt: t.timestamp("last_active_at", { withTimezone: true }),
	role: t.text("role"),
	banned: t.boolean("banned").default(false),
	banReason: t.text("ban_reason"),
	banExpires: t.timestamp("ban_expires", { withTimezone: true }),
});

export const session = t.pgTable(
	"session",
	{
		id: t.text("id").primaryKey(),
		expiresAt: t.timestamp("expires_at", { withTimezone: true }).notNull(),
		token: t.text("token").notNull().unique(),
		createdAt: t
			.timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: t
			.timestamp("updated_at", { withTimezone: true })
			.$onUpdate(() => new Date())
			.notNull(),
		ipAddress: t.text("ip_address"),
		userAgent: t.text("user_agent"),
		userId: t
			.text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		activeOrganizationId: t.text("active_organization_id"),
		impersonatedBy: t.text("impersonated_by"),
	},
	(table) => [t.index("session_userId_idx").on(table.userId)],
);

export const account = t.pgTable(
	"account",
	{
		id: t.text("id").primaryKey(),
		accountId: t.text("account_id").notNull(),
		providerId: t.text("provider_id").notNull(),
		userId: t
			.text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		accessToken: t.text("access_token"),
		refreshToken: t.text("refresh_token"),
		idToken: t.text("id_token"),
		accessTokenExpiresAt: t.timestamp("access_token_expires_at", {
			withTimezone: true,
		}),
		refreshTokenExpiresAt: t.timestamp("refresh_token_expires_at", {
			withTimezone: true,
		}),
		scope: t.text("scope"),
		password: t.text("password"),
		createdAt: t
			.timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: t
			.timestamp("updated_at", { withTimezone: true })
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [t.index("account_userId_idx").on(table.userId)],
);

export const verification = t.pgTable(
	"verification",
	{
		id: t.text("id").primaryKey(),
		identifier: t.text("identifier").notNull(),
		value: t.text("value").notNull(),
		expiresAt: t.timestamp("expires_at", { withTimezone: true }).notNull(),
		createdAt: t
			.timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: t
			.timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [t.index("verification_identifier_idx").on(table.identifier)],
);

export const organization = t.pgTable(
	"organization",
	{
		id: t.text("id").primaryKey(),
		name: t.text("name").notNull(),
		slug: t.text("slug").notNull(),
		logo: t.text("logo"),
		createdAt: t.timestamp("created_at", { withTimezone: true }).notNull(),
		metadata: t.text("metadata"),
	},
	(table) => [t.unique("organization_slug_uidx").on(table.slug)],
);

export const member = t.pgTable(
	"member",
	{
		id: t.text("id").primaryKey(),
		organizationId: t
			.text("organization_id")
			.notNull()
			.references(() => organization.id, { onDelete: "cascade" }),
		userId: t
			.text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		role: t.text("role").default("member").notNull(),
		createdAt: t
			.timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: t
			.timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [
		t.index("member_organizationId_idx").on(table.organizationId),
		t.index("member_userId_idx").on(table.userId),
	],
);

export const invitation = t.pgTable(
	"invitation",
	{
		id: t.text("id").primaryKey(),
		organizationId: t
			.text("organization_id")
			.notNull()
			.references(() => organization.id, { onDelete: "cascade" }),
		email: t.text("email").notNull(),
		role: t.text("role"),
		status: t.text("status").default("pending").notNull(),
		expiresAt: t.timestamp("expires_at", { withTimezone: true }).notNull(),
		createdAt: t
			.timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		inviterId: t
			.text("inviter_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
	},
	(table) => [
		t.index("invitation_organizationId_idx").on(table.organizationId),
		t.index("invitation_email_idx").on(table.email),
	],
);

export const rateLimit = t.pgTable("rate_limit", {
	id: t.text("id").primaryKey(),
	key: t.text("key").notNull().unique(),
	count: t.integer("count").notNull(),
	lastRequest: t.bigint("last_request", { mode: "number" }).notNull(),
});

export const apikey = t.pgTable(
	"apikey",
	{
		id: t.text("id"),
		configId: t.text("config_id").notNull(),
		name: t.text("name"),
		start: t.text("start"),
		prefix: t.text("prefix"),
		key: t.text("key").notNull(),
		referenceId: t.text("reference_id").notNull(),
		refillInterval: t.integer("refill_interval"),
		refillAmount: t.integer("refill_amount"),
		lastRefillAt: t.timestamp("last_refill_at", { withTimezone: true }),
		enabled: t.boolean("enabled"),
		rateLimitEnabled: t.boolean("rate_limit_enabled"),
		rateLimitTimeWindow: t.integer("rate_limit_time_window"),
		rateLimitMax: t.integer("rate_limit_max"),
		requestCount: t.integer("request_count"),
		remaining: t.integer("remaining"),
		lastRequest: t.timestamp("last_request", { withTimezone: true }),
		expiresAt: t.timestamp("expires_at", { withTimezone: true }),
		createdAt: t.timestamp("created_at", { withTimezone: true }).notNull(),
		updatedAt: t.timestamp("updated_at", { withTimezone: true }).notNull(),
		permissions: t.text("permissions"),
		metadata: t.text("metadata"),
	},
	(table) => [
		t.primaryKey({
			columns: [table.id],
		}),
		t.unique().on(table.key),
		t.index().on(table.referenceId),
	],
);

/**
 * APPLICATION-SPECIFIC TABLES
 */

export const aggregateType = t.pgEnum("aggregate_type", [
	"invoice",
	"organization",
	"phase",
	"project",
]);

export const actorType = t.pgEnum("actor_type", ["user", "organization"]);

export const projectState = t.pgEnum("project_state", [
	"draft",
	"active",
	"completed",
	"archived",
]);

export const projects = t.pgTable(
	"projects",
	{
		id: t.uuid("id").default(sql`uuidv7()`).notNull(),
		publicId: t.text("public_id").notNull(),
		organizationId: t.text("organization_id").notNull(),
		name: t.text("name").notNull(),
		state: projectState("state").notNull(),
		updatedAt: t
			.timestamp("updated_at", { withTimezone: true })
			.$onUpdate(() => new Date()),
	},
	(table) => [
		t.primaryKey({
			columns: [table.id],
		}),
		t.uniqueIndex().on(table.publicId),
		t.index("projects_organization_id_idx").on(table.organizationId),
		t
			.foreignKey({
				columns: [table.organizationId],
				foreignColumns: [organization.id],
			})
			.onUpdate("cascade")
			.onDelete("restrict"),
	],
);

export const phaseState = t.pgEnum("phase_state", [
	"submitted",
	"planned",
	"approved",
	"in_progress",
	"invoiced",
	"paid",
	"cancelled",
]);

export const phases = t.pgTable(
	"phases",
	{
		id: t.uuid("id").default(sql`uuidv7()`).notNull(),
		publicId: t.text("public_id").notNull(),
		projectId: t.uuid("project_id").notNull(),
		title: t.text("title").notNull(),
		cost: t
			.numeric("cost", { precision: 19, scale: 4, mode: "number" })
			.notNull(),
		currency: t.char("currency", { length: 3 }).notNull(),
		state: phaseState("state").notNull(),
		dueAt: t.timestamp("due_at", { withTimezone: true }),
		updatedAt: t
			.timestamp("updated_at", { withTimezone: true })
			.$onUpdate(() => new Date()),
		externalUrl: t.text("external_url"),
	},
	(table) => [
		t.primaryKey({
			columns: [table.id],
		}),
		t.uniqueIndex().on(table.publicId),
		t.index("phases_project_id_idx").on(table.projectId),
		t
			.foreignKey({
				columns: [table.projectId],
				foreignColumns: [projects.id],
			})
			.onUpdate("cascade")
			.onDelete("restrict"),
	],
);

export const invoices = t.pgTable(
	"invoices",
	{
		id: t.uuid("id").default(sql`uuidv7()`).notNull(),
		publicId: t.text("public_id").notNull(),
		phaseId: t.uuid("phase_id").notNull(),
		invoiceNumber: t.text("invoice_number").notNull(),
		stripeId: t.text("stripe_id").notNull(),
		stripePaymentPage: t.text("stripe_payment_page").notNull(),
		total: t
			.numeric("total", { precision: 19, scale: 4, mode: "number" })
			.notNull(),
		updatedAt: t
			.timestamp("updated_at", { withTimezone: true })
			.$onUpdate(() => new Date()),
		stripeStatus: t.text("stripe_status"),
		stripePaidAt: t.timestamp("stripe_paid_at", { withTimezone: true }),
		fetchedAt: t.timestamp("fetched_at", { withTimezone: true }),
	},
	(table) => [
		t.primaryKey({
			columns: [table.id],
		}),
		t.uniqueIndex().on(table.publicId),
		t.uniqueIndex("invoices_phase_id_uidx").on(table.phaseId),
		t
			.foreignKey({
				columns: [table.phaseId],
				foreignColumns: [phases.id],
			})
			.onUpdate("cascade")
			.onDelete("restrict"),
	],
);

export const events = t.pgTable(
	"events",
	{
		id: t.uuid("id").default(sql`uuidv7()`).notNull(),
		publicId: t.text("public_id").notNull(),
		aggregateType: aggregateType("aggregate_type").notNull(),
		aggregateId: t.text("aggregate_id").notNull(),
		event: t.text("event_type").notNull(),
		actorType: actorType("actor_type").notNull(),
		actorId: t.text("actor_id").notNull(),
	},
	(table) => [
		t.primaryKey({
			columns: [table.id],
		}),
		t
			.index("events_aggregate_type_id_idx")
			.on(table.aggregateType, table.aggregateId),
	],
);

export const organizationMetadata = t.pgTable(
	"organization_metadata",
	{
		id: t.uuid("id").defaultRandom().primaryKey(),
		organizationId: t
			.text("organization_id")
			.notNull()
			.references(() => organization.id, { onDelete: "cascade" }),
		yearlyBudget: t.integer("yearly_budget"),
		createdAt: t
			.timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: t
			.timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [
		t
			.uniqueIndex("organization_metadata_organizationId_uidx")
			.on(table.organizationId),
	],
);

export const organizationMetadataInsertSchema =
	createInsertSchema(organizationMetadata);
export const organizationMetadataUpdateSchema =
	createUpdateSchema(organizationMetadata);

export type projectSelectType = typeof projects.$inferSelect;
export type phaseSelectType = typeof phases.$inferSelect;
export type invoiceSelectType = typeof invoices.$inferSelect;
export type eventSelectType = typeof events.$inferSelect;
