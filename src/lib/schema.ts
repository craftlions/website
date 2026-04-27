import * as t from "drizzle-orm/pg-core";
import { pgTable } from "drizzle-orm/pg-core";

export const user = pgTable("user", {
	id: t.text("id").primaryKey(),
	name: t.text("name").notNull(),
	email: t.varchar("email", { length: 255 }).notNull().unique(),
	emailVerified: t.boolean("email_verified").notNull(),
	image: t.text("image"),
	createdAt: t.timestamp("created_at", { precision: 6, withTimezone: true }).notNull(),
	updatedAt: t.timestamp("updated_at", { precision: 6, withTimezone: true }).notNull(),
	role: t.text("role"),
	banned: t.boolean("banned"),
	banReason: t.text("ban_reason"),
	banExpires: t.timestamp("ban_expires", { precision: 6, withTimezone: true }),
});

export const session = pgTable("session", {
	id: t.text("id").primaryKey(),
	userId: t.text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
	token: t.varchar("token", { length: 255 }).notNull().unique(),
	expiresAt: t.timestamp("expires_at", { precision: 6, withTimezone: true }).notNull(),
	ipAddress: t.text("ip_address"),
	userAgent: t.text("user_agent"),
	createdAt: t.timestamp("created_at", { precision: 6, withTimezone: true }).notNull(),
	updatedAt: t.timestamp("updated_at", { precision: 6, withTimezone: true }).notNull(),
	activeOrganizationId: t.text("active_organization_id"),
	activeTeamId: t.text("active_team_id"),
	impersonatedBy: t.text("impersonated_by"),
});

export const account = pgTable("account", {
	id: t.text("id").primaryKey(),
	userId: t.text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
	accountId: t.text("account_id").notNull(),
	providerId: t.text("provider_id").notNull(),
	accessToken: t.text("access_token"),
	refreshToken: t.text("refresh_token"),
	accessTokenExpiresAt: t.timestamp("access_token_expires_at", { precision: 6, withTimezone: true }),
	refreshTokenExpiresAt: t.timestamp("refresh_token_expires_at", { precision: 6, withTimezone: true }),
	scope: t.text("scope"),
	idToken: t.text("id_token"),
	password: t.text("password"),
	createdAt: t.timestamp("created_at", { precision: 6, withTimezone: true }).notNull(),
	updatedAt: t.timestamp("updated_at", { precision: 6, withTimezone: true }).notNull(),
});

export const verification = pgTable("verification", {
	id: t.text("id").primaryKey(),
	identifier: t.text("identifier").notNull(),
	value: t.text("value").notNull(),
	expiresAt: t.timestamp("expires_at", { precision: 6, withTimezone: true }).notNull(),
	createdAt: t.timestamp("created_at", { precision: 6, withTimezone: true }).notNull(),
	updatedAt: t.timestamp("updated_at", { precision: 6, withTimezone: true }).notNull(),
});

export const rateLimit = pgTable("rate_limit", {
	id: t.text("id").primaryKey(),
	key: t.varchar("key", { length: 255 }).notNull().unique(),
	count: t.integer("count").notNull(),
	lastRequest: t.bigint("last_request", {mode: "string"}).notNull(),
});

export const organization = pgTable("organization", {
	id: t.text("id").primaryKey(),
	name: t.text("name").notNull(),
	slug: t.varchar("slug", { length: 255 }).notNull().unique(),
	logo: t.text("logo"),
	metadata: t.text("metadata"),
	createdAt: t.timestamp("created_at", { precision: 6, withTimezone: true }).notNull(),
});

export const member = pgTable("member", {
	id: t.text("id").primaryKey(),
	userId: t.text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
	organizationId: t.text("organization_id").notNull().references(() => organization.id, { onDelete: "cascade" }),
	role: t.text("role").notNull(),
	createdAt: t.timestamp("created_at", { precision: 6, withTimezone: true }).notNull(),
});

export const invitation = pgTable("invitation", {
	id: t.text("id").primaryKey(),
	email: t.text("email").notNull(),
	inviterId: t.text("inviter_id").notNull().references(() => user.id, { onDelete: "cascade" }),
	organizationId: t.text("organization_id").notNull().references(() => organization.id, { onDelete: "cascade" }),
	role: t.text("role"),
	status: t.text("status").notNull(),
	createdAt: t.timestamp("created_at", { precision: 6, withTimezone: true }).notNull(),
	expiresAt: t.timestamp("expires_at", { precision: 6, withTimezone: true }).notNull(),
});

export const project = pgTable("project", {
	id: t.text("id").primaryKey(),
	organizationId: t
		.text("organization_id")
		.notNull()
		.references(() => organization.id, { onDelete: "cascade" }),
	name: t.text("name").notNull(),
	budget: t.integer("budget"),
	deadline: t.timestamp("deadline", { precision: 6, withTimezone: true }),
	stateOfWork: t.text("state_of_work"),
	stateOfPayment: t.text("state_of_payment"),
	createdAt: t.timestamp("created_at", { precision: 6, withTimezone: true }).notNull(),
})

export const organizationMetadata = pgTable("organization_metadata", {
	id: t.text("id").primaryKey(),
	organizationId: t
		.text("organization_id")
		.notNull()
		.references(() => organization.id, { onDelete: "cascade" }),
	yearlyBudget: t.integer("yearly_budget"),
	createdAt: t.timestamp("created_at", { precision: 6, withTimezone: true }).notNull(),
	updatedAt: t.timestamp("updated_at", { precision: 6, withTimezone: true }).notNull(),
});