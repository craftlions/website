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
		version: t.integer("version").default(0).notNull(),
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

export const invoiceOverdueEvaluationState = t.pgEnum(
	"invoice_overdue_evaluation_state",
	["pending", "eligible", "ineligible"],
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
		version: t.integer("version").default(0).notNull(),
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
		organizationId: t.text("organization_id").notNull(),
		phaseId: t.uuid("phase_id"),
		invoiceNumber: t.text("invoice_number").notNull(),
		stripeId: t.text("stripe_id").notNull(),
		stripePaymentPage: t.text("stripe_payment_page").notNull(),
		currency: t.char("currency", { length: 3 }).notNull(),
		total: t
			.numeric("total", { precision: 19, scale: 4, mode: "number" })
			.notNull(),
		updatedAt: t
			.timestamp("updated_at", { withTimezone: true })
			.$onUpdate(() => new Date()),
		stripeStatus: t.text("stripe_status"),
		stripePaidAt: t.timestamp("stripe_paid_at", { withTimezone: true }),
		stripeDueAt: t.timestamp("stripe_due_at", { withTimezone: true }),
		fetchedAt: t.timestamp("fetched_at", { withTimezone: true }),
	},
	(table) => [
		t.primaryKey({
			columns: [table.id],
		}),
		t.uniqueIndex().on(table.publicId),
		t.uniqueIndex("invoices_phase_id_uidx").on(table.phaseId),
		t.uniqueIndex("invoices_stripe_id_uidx").on(table.stripeId),
		t.index("invoices_organization_id_idx").on(table.organizationId),
		t
			.foreignKey({
				columns: [table.phaseId],
				foreignColumns: [phases.id],
			})
			.onUpdate("cascade")
			.onDelete("restrict"),
		t
			.foreignKey({
				columns: [table.organizationId],
				foreignColumns: [organization.id],
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
		aggregateVersion: t.integer("aggregate_version"),
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
		t
			.uniqueIndex("events_aggregate_type_id_version_uidx")
			.on(table.aggregateType, table.aggregateId, table.aggregateVersion),
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
		stripeCustomerId: t.text("stripe_customer_id"),
	},
	(table) => [
		t
			.uniqueIndex("organization_metadata_organizationId_uidx")
			.on(table.organizationId),
		t
			.index("organization_metadata_stripeCustomerId_idx")
			.on(table.stripeCustomerId),
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
export type notificationIntentSelectType =
	typeof notificationIntent.$inferSelect;
export type notificationStageResultSelectType =
	typeof notificationStageResult.$inferSelect;

/**
 * NOTIFICATION TABLES
 */

export const notificationKind = t.pgEnum("notification_kind", [
	"phase_approval",
]);

export const notificationIntentState = t.pgEnum("notification_intent_state", [
	"pending",
	"dispatching",
	"dispatched",
]);

export const notificationIntent = t.pgTable(
	"notification_intent",
	{
		id: t.uuid("id").defaultRandom().primaryKey(),
		kind: notificationKind("kind").notNull(),
		aggregateType: aggregateType("aggregate_type").notNull(),
		aggregateId: t.uuid("aggregate_id").notNull(),
		organizationId: t
			.text("organization_id")
			.notNull()
			.references(() => organization.id, { onDelete: "cascade" }),
		state: notificationIntentState("state").default("pending").notNull(),
		workflowId: t.text("workflow_id"),
		dispatchedAt: t.timestamp("dispatched_at", { withTimezone: true }),
		createdAt: t
			.timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		t.index("notification_intent_kind_idx").on(table.kind),
		t.index("notification_intent_state_idx").on(table.state),
		t
			.index("notification_intent_aggregate_idx")
			.on(table.aggregateType, table.aggregateId),
		t
			.uniqueIndex("notification_intent_kind_aggregate_uidx")
			.on(table.kind, table.aggregateType, table.aggregateId),
	],
);

export const notificationStage = t.pgEnum("notification_stage", [
	"initial_notice",
]);

export const notificationStageState = t.pgEnum("notification_stage_state", [
	"pending",
	"sent",
	"skipped",
	"errored",
]);

export const notificationStageResult = t.pgTable(
	"notification_stage_result",
	{
		id: t.uuid("id").defaultRandom().primaryKey(),
		intentId: t
			.uuid("intent_id")
			.notNull()
			.references(() => notificationIntent.id, { onDelete: "cascade" }),
		stage: notificationStage("stage").notNull(),
		state: notificationStageState("state").default("pending").notNull(),
		sentMessageId: t.text("sent_message_id"),
		sentAt: t.timestamp("sent_at", { withTimezone: true }),
		skippedReason: t.text("skipped_reason"),
		failures: t.integer("failures").default(0).notNull(),
		lastError: t.text("last_error"),
		createdAt: t
			.timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: t
			.timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		t.index("notification_stage_result_intent_idx").on(table.intentId),
		t.index("notification_stage_result_state_idx").on(table.state),
		t
			.uniqueIndex("notification_stage_result_intent_stage_uidx")
			.on(table.intentId, table.stage),
	],
);

export const invoiceOverdueEvaluation = t.pgTable(
	"invoice_overdue_evaluation",
	{
		id: t.uuid("id").defaultRandom().primaryKey(),
		invoiceId: t
			.uuid("invoice_id")
			.notNull()
			.references(() => invoices.id, { onDelete: "cascade" }),
		state: invoiceOverdueEvaluationState("state").notNull(),
		createdAt: t
			.timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		t
			.uniqueIndex("invoice_overdue_evaluation_invoice_uidx")
			.on(table.invoiceId),
	],
);
