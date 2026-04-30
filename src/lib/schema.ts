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
		slug: t.text("slug").notNull().unique(),
		logo: t.text("logo"),
		createdAt: t.timestamp("created_at", { withTimezone: true }).notNull(),
		metadata: t.text("metadata"),
	},
	(table) => [t.uniqueIndex("organization_slug_uidx").on(table.slug)],
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

/**
 * APPLICATION-SPECIFIC TABLES
 */

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

export const aggregateType = t.pgEnum("aggregate_type", [
	"invoice",
	"milestone",
	"project",
]);

export const actorType = t.pgEnum("actor_type", ["user", "organization"]);

export const event = t.pgTable(
	"event",
	{
		id: t.uuid("id").defaultRandom(),
		aggregateType: aggregateType("aggregate_type").notNull(),
		aggregateId: t.uuid("aggregate_id").notNull(),
		eventType: t.text("event_type").notNull(),
		payload: t.jsonb("payload").notNull(),
		version: t.integer("version").notNull(),
		actorType: actorType("actor_type").notNull(),
		actorId: t.text("actor_id").notNull(),
		// occuredAt
		metadata: t.jsonb("metadata"),
		recordedAt: t
			.timestamp("recorded_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		t.primaryKey({
			columns: [table.id],
		}),
		t.uniqueIndex().on(table.aggregateType, table.aggregateId, table.version),
		t.index().on(table.actorType, table.actorId, table.recordedAt),
		t.index().on(table.recordedAt),
	],
);

// we need to define this view with raw sql because we need the explicit column definitions for drizzle relations
export const project = t
	.pgView("project", {
		id: t.uuid("id").notNull(),
		organizationId: t.text("organization_id").notNull(),
		name: t.text("name").notNull(),
		deadline: t.timestamp("deadline", { withTimezone: true }),
		stateOfWork: t.text("state_of_work"),
		stateOfPayment: t.text("state_of_payment"),
		createdAt: t.timestamp("created_at", { withTimezone: true }).notNull(),
		updatedAt: t.timestamp("updated_at", { withTimezone: true }).notNull(),
	})
	.as(sql`
			with project_events as (
				select
					${event.aggregateId} as aggregate_id,
					${event.version} as version,
					${event.recordedAt} as recorded_at,
					${event.payload} as payload
				from ${event}
				where ${event.aggregateType} = 'project'
			),
			latest_change as (
				select distinct on (e.aggregate_id, c.key)
					e.aggregate_id,
					c.key as field,
					c.value ->> 'to' as value
				from project_events e
				cross join lateral jsonb_each(
					coalesce(e.payload -> 'changes', '{}'::jsonb)
				) as c(key, value)
				where c.key in (
					'organization_id',
					'name',
					'deadline',
					'state_of_work',
					'state_of_payment'
				)
				and c.value ? 'to'
				order by e.aggregate_id, c.key, e.version desc
			),
			created as (
				select distinct on (aggregate_id)
					aggregate_id,
					recorded_at as created_at
				from project_events
				order by aggregate_id, version asc
			),
			updated as (
				select distinct on (aggregate_id)
					aggregate_id,
					recorded_at as updated_at
				from project_events
				order by aggregate_id, version desc
			)
			select
				c.aggregate_id as "id",
				max(l.value) filter (where l.field = 'organization_id') as "organization_id",
				max(l.value) filter (where l.field = 'name') as "name",
				(max(l.value) filter (where l.field = 'deadline'))::timestamp with time zone as "deadline",
				max(l.value) filter (where l.field = 'state_of_work') as "state_of_work",
				max(l.value) filter (where l.field = 'state_of_payment') as "state_of_payment",
				c.created_at as "created_at",
				u.updated_at as "updated_at"
			from created c
			inner join updated u
				on u.aggregate_id = c.aggregate_id
			left join latest_change l
				on l.aggregate_id = c.aggregate_id
			group by c.aggregate_id, c.created_at, u.updated_at
		`);

// we need to define this view with raw sql because we need the explicit column definitions for drizzle relations
export const invoice = t
	.pgView("invoice", {
		id: t.uuid("id").notNull(),
		projectId: t.uuid("project_id").notNull(),
		invoiceNumber: t.text("invoice_number").notNull(),
		stripeId: t.text("stripe_id").notNull(),
		stripePaymentPage: t.text("stripe_payment_page").notNull(),
		createdAt: t.timestamp("created_at", { withTimezone: true }).notNull(),
		total: t
			.numeric("total", { precision: 19, scale: 4, mode: "number" })
			.notNull(),
	})
	.as(sql`
			with invoice_events as (
				select
					${event.aggregateId} as aggregate_id,
					${event.version} as version,
					${event.recordedAt} as recorded_at,
					${event.payload} as payload
				from ${event}
				where ${event.aggregateType} = 'invoice'
			),
			latest_change as (
				select distinct on (e.aggregate_id, c.key)
					e.aggregate_id,
					c.key as field,
					c.value ->> 'to' as value
				from invoice_events e
				cross join lateral jsonb_each(
					coalesce(e.payload -> 'changes', '{}'::jsonb)
				) as c(key, value)
				where c.key in (
					'project_id',
					'invoice_number',
					'stripe_id',
					'stripe_payment_page',
					'total'
				)
				and c.value ? 'to'
				order by e.aggregate_id, c.key, e.version desc
			),
			created as (
				select distinct on (aggregate_id)
					aggregate_id,
					recorded_at as created_at
				from invoice_events
				order by aggregate_id, version asc
			)
			select
				c.aggregate_id as "id",
				(max(l.value) filter (where l.field = 'project_id'))::uuid as "project_id",
				max(l.value) filter (where l.field = 'invoice_number') as "invoice_number",
				max(l.value) filter (where l.field = 'stripe_id') as "stripe_id",
				max(l.value) filter (where l.field = 'stripe_payment_page') as "stripe_payment_page",
				c.created_at as "created_at",
				(max(l.value) filter (where l.field = 'total'))::numeric as "total"
			from created c
			left join latest_change l
				on l.aggregate_id = c.aggregate_id
			group by c.aggregate_id, c.created_at
		`);

// we need to define this view with raw sql because we need the explicit column definitions for drizzle relations
export const milestone = t
	.pgView("milestone", {
		id: t.uuid("id").notNull(),
		projectId: t.uuid("project_id").notNull(),
		title: t.text("title").notNull(),
		cost: t
			.numeric("cost", { precision: 19, scale: 4, mode: "number" })
			.notNull(),
		currency: t.char("currency", { length: 3 }).notNull(),
		state: t.text("state").notNull(),
		dueAt: t.timestamp("due_at", { withTimezone: true }),
		createdAt: t.timestamp("created_at", { withTimezone: true }).notNull(),
	})
	.as(sql`
			with milestone_events as (
				select
					${event.aggregateId} as aggregate_id,
					${event.version} as version,
					${event.recordedAt} as recorded_at,
					${event.payload} as payload
				from ${event}
				where ${event.aggregateType} = 'milestone'
			),
			latest_change as (
				select distinct on (e.aggregate_id, c.key)
					e.aggregate_id,
					c.key as field,
					c.value ->> 'to' as value
				from milestone_events e
				cross join lateral jsonb_each(
					coalesce(e.payload -> 'changes', '{}'::jsonb)
				) as c(key, value)
				where c.key in (
					'project_id',
					'title',
					'cost',
					'currency',
					'state',
					'due_at'
				)
				and c.value ? 'to'
				order by e.aggregate_id, c.key, e.version desc
			),
			created as (
				select distinct on (aggregate_id)
					aggregate_id,
					recorded_at as created_at
				from milestone_events
				order by aggregate_id, version asc
			)
			select
				c.aggregate_id as "id",
				(max(l.value) filter (where l.field = 'project_id'))::uuid as "project_id",
				max(l.value) filter (where l.field = 'title') as "title",
				(max(l.value) filter (where l.field = 'cost'))::numeric as "cost",
				max(l.value) filter (where l.field = 'currency') as "currency",
				max(l.value) filter (where l.field = 'state') as "state",
				(max(l.value) filter (where l.field = 'due_at'))::timestamp with time zone as "due_at",
				c.created_at as "created_at"
			from created c
			left join latest_change l
				on l.aggregate_id = c.aggregate_id
			group by c.aggregate_id, c.created_at
		`);

export type milestoneSelectType = typeof milestone.$inferSelect;
