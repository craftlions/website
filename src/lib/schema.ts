import * as t from "drizzle-orm/pg-core";
import { pgTable } from "drizzle-orm/pg-core";
import { createInsertSchema, createUpdateSchema } from "drizzle-orm/zod";

export const user = pgTable("user", {
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
		.$onUpdate(() => /* @__PURE__ */ new Date())
		.notNull(),
	lastActiveAt: t.timestamp("last_active_at", { withTimezone: true }),
	role: t.text("role"),
	banned: t.boolean("banned").default(false),
	banReason: t.text("ban_reason"),
	banExpires: t.timestamp("ban_expires", { withTimezone: true }),
});

export const session = pgTable(
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
			.$onUpdate(() => /* @__PURE__ */ new Date())
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

export const account = pgTable(
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
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
	},
	(table) => [t.index("account_userId_idx").on(table.userId)],
);

export const verification = pgTable(
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
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
	},
	(table) => [t.index("verification_identifier_idx").on(table.identifier)],
);

export const organization = pgTable(
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

export const member = pgTable(
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
		createdAt: t.timestamp("created_at", { withTimezone: true }).notNull(),
	},
	(table) => [
		t.index("member_organizationId_idx").on(table.organizationId),
		t.index("member_userId_idx").on(table.userId),
	],
);

export const invitation = pgTable(
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

export const rateLimit = pgTable("rate_limit", {
	id: t.text("id").primaryKey(),
	key: t.text("key").notNull().unique(),
	count: t.integer("count").notNull(),
	lastRequest: t.bigint("last_request", { mode: "number" }).notNull(),
});

export const project = pgTable(
	"project",
	{
		id: t.uuid("id").defaultRandom().primaryKey(),
		organizationId: t
			.text("organization_id")
			.notNull()
			.references(() => organization.id, { onDelete: "cascade" }),
		name: t.text("name").notNull(),
		budget: t.integer("budget"),
		deadline: t.timestamp("deadline", { precision: 6, withTimezone: true }),
		stateOfWork: t.text("state_of_work"),
		stateOfPayment: t.text("state_of_payment"),
		createdAt: t
			.timestamp("created_at", { precision: 6, withTimezone: true })
			.notNull(),
	},
	(table) => [t.index("project_organizationId_idx").on(table.organizationId)],
);

export const projectInsertSchema = createInsertSchema(project);
export const projectUpdateSchema = createUpdateSchema(project);

export const organizationMetadata = pgTable(
	"organization_metadata",
	{
		id: t.uuid("id").defaultRandom().primaryKey(),
		organizationId: t
			.text("organization_id")
			.notNull()
			.references(() => organization.id, { onDelete: "cascade" }),
		yearlyBudget: t.integer("yearly_budget"),
		createdAt: t
			.timestamp("created_at", { precision: 6, withTimezone: true })
			.notNull(),
		updatedAt: t
			.timestamp("updated_at", { precision: 6, withTimezone: true })
			.notNull(),
	},
	(table) => [
		t
			.uniqueIndex("organization_metadata_organizationId_uidx")
			.on(table.organizationId),
	],
);
